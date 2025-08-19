from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import re
import random
import string
import uuid
import json
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

# E-posta ayarları - Kullanıcının verdiği bilgiler
EMAIL_SENDER = "no-reply@eracochillers.com"
EMAIL_PASSWORD = "eaqsdreaarhbnvdq"  # 16 haneli uygulama şifresi
EMAIL_RECEIVER = "sila.yilmazz.0789@gmail.com"

def load_products():
    """Ürün listesini JSON dosyasından yükler"""
    try:
        with open('products.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data['products']
    except Exception as e:
        print(f"Ürün dosyası yüklenemedi: {e}")
        return []

# Yeni: Ürün hataları verisini yükleme ve esnek eşleme yardımcıları
def load_error_data():
    """Ürün hataları verisini JSON dosyasından yükler"""
    try:
        with open('urun_hatalari.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Ürün hataları dosyası yüklenemedi: {e}")
        return []

# Garanti verisi için yardımcılar
def load_warranty_data():
    """Garanti veri setini JSON dosyasından yükler. Dosya adı esnek: 'GARANTİ SÜRELERİ.json' vb."""
    import os, unicodedata
    candidates = [
        'garanti_urunleri.json',
        'GARANTİ SÜRELERİ.json',
        'GARANTI SURELERI.json',
        'garanti sureleri.json'
    ]
    for name in candidates:
        if os.path.exists(name):
            try:
                with open(name, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Garanti verisi yüklenemedi ({name}): {e}")
    # Klasörde tarayıp normalize ederek bulmayı dene
    try:
        for fname in os.listdir('.'):
            if not fname.lower().endswith('.json'):
                continue
            norm = unicodedata.normalize('NFKD', fname).encode('ascii', 'ignore').decode('ascii').lower()
            if 'garanti' in norm and ('sure' in norm or 'süre' in fname.lower()):
                with open(fname, 'r', encoding='utf-8') as f:
                    return json.load(f)
    except Exception as e:
        print(f"Garanti veri araması başarısız: {e}")
    return []

def add_months_to_date(source_date: datetime, months: int) -> datetime:
    """Bir tarihe ay ekler; ay sonu taşmalarını düzgün ele alır."""
    year = source_date.year + (source_date.month - 1 + months) // 12
    month = (source_date.month - 1 + months) % 12 + 1
    day = source_date.day
    # Ay sonu düzeltmesi
    last_day_of_target_month = (datetime(year + (month // 12), (month % 12) + 1, 1) - timedelta(days=1)).day if month != 12 else 31
    day = min(day, last_day_of_target_month)
    return datetime(year, month, day)

def parse_purchase_date(date_str: str) -> datetime | None:
    """Satın alma/sevk tarihini birden çok formattan parse eder."""
    if not date_str:
        return None
    date_str = str(date_str).strip()
    # Yaygın formatlar + US formatı (MM/DD/YYYY)
    for fmt in ['%Y-%m-%d', '%d.%m.%Y', '%d/%m/%Y', '%Y/%m/%d', '%m/%d/%Y', '%m-%d-%Y']:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None

def normalize_text_for_match(text: str) -> str:
    """Karşılaştırma için metni normalize eder: küçük harfe çevirir, özel karakterleri kaldırır, boşlukları sadeleştirir"""
    text = text.lower().strip()
    text = re.sub(r'[^a-z0-9\s]', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text

def find_error_entry(query: str):
    """Kullanıcıdan gelen sorguya göre urun_hatalari.json içinde esnek eşleme yapar"""
    errors = load_error_data()
    if not query:
        return None

    q_norm = normalize_text_for_match(query)
    # Kod araması için alfasayısal sıkılaştırılmış token
    code_token = re.sub(r'[^a-z0-9]', '', query.lower())

    for err in errors:
        st_code_raw = (err.get('st542_kodu') or '').strip()
        carel_code_raw = (err.get('carel_kodu') or '').strip()

        # "ER05 / ER06" gibi değerleri tek tek tokenlara ayır
        st_tokens = [t.lower() for t in re.findall(r'[a-zA-Z]+\d+', st_code_raw.replace(' ', ''))]
        carel_tokens = [t.lower() for t in re.findall(r'[a-zA-Z]+\d+', carel_code_raw.replace(' ', ''))]

        if code_token and (code_token in st_tokens or code_token in carel_tokens):
            return err

        # Metin alanlarında esnek eşleme (plc_ekran, aciklama, sebep)
        for field in ['plc_ekran', 'aciklama', 'sebep']:
            val = (err.get(field) or '').strip()
            if not val:
                continue
            val_norm = normalize_text_for_match(val)
            if q_norm and (q_norm in val_norm or val_norm in q_norm):
                return err

    return None

# Garanti kontrolü: ürün adı + seri numarasından kaydı bul ve garanti durumunu hesapla
def find_warranty_record(product_name: str, serial_number: str):
    records = load_warranty_data()
    if not records:
        return None, None

    name_norm = normalize_text_for_match(product_name)
    serial_norm = normalize_text_for_match(serial_number)
    # Boşlukları tamamen kaldırarak daha esnek karşılaştırma yap
    name_norm_ns = re.sub(r'\s+', '', name_norm)
    serial_norm_ns = re.sub(r'\s+', '', serial_norm)

    for rec in records:
        # Esnek alan adları
        rec_name = rec.get('name') or rec.get('urun_adi') or rec.get('Ürün Adı') or ''
        rec_serial = rec.get('serial') or rec.get('seri_no') or rec.get('Seri No') or ''
        rec_name_norm = normalize_text_for_match(rec_name)
        rec_serial_norm = normalize_text_for_match(rec_serial)
        rec_name_norm_ns = re.sub(r'\s+', '', rec_name_norm)
        rec_serial_norm_ns = re.sub(r'\s+', '', rec_serial_norm)
        if rec_name_norm_ns == name_norm_ns and rec_serial_norm_ns == serial_norm_ns:
            # Tarih alanını toparla (Sevk Tarihi / satın alma)
            raw_date = rec.get('purchase_date') or rec.get('satin_alma_tarihi') or rec.get('Sevk Tarihi') or ''
            purchase_dt = parse_purchase_date(raw_date)
            # 1 yıl garanti varsayımı
            warranty_months = 12
            return rec, (purchase_dt, warranty_months)

    return None, None

def compute_warranty_status(purchase_dt: datetime | None, warranty_months: int):
    if not purchase_dt or not warranty_months or warranty_months <= 0:
        return {
            'has_warranty_info': False,
            'in_warranty': False,
            'ends_on': None,
            'days_remaining': None
        }
    # Sevk tarihinden itibaren 1 yıl (365 gün) garanti
    end_dt = purchase_dt + timedelta(days=365)
    today = datetime.now()
    in_warranty = today <= end_dt
    days_remaining = (end_dt - today).days
    return {
        'has_warranty_info': True,
        'in_warranty': in_warranty,
        'ends_on': end_dt.strftime('%Y-%m-%d'),
        'days_remaining': max(days_remaining, 0)
    }

def init_database():
    """Veritabanını oluşturur"""
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    
    # Kullanıcılar tablosu
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id TEXT PRIMARY KEY, email TEXT, email_verified BOOLEAN DEFAULT FALSE, 
                  product_verified BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    
    # Eksik sütunları ekle (migrasyon)
    try:
        c.execute('ALTER TABLE users ADD COLUMN product_verified BOOLEAN DEFAULT FALSE')
    except Exception:
        pass
    try:
        c.execute('ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE')
    except Exception:
        pass
    
    # Doğrulama kodları tablosu
    c.execute('''CREATE TABLE IF NOT EXISTS verification_codes
                 (user_id TEXT PRIMARY KEY, email_code TEXT, email_verified BOOLEAN DEFAULT FALSE,
                  code_expires TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users (id))''')
    
    # Chat geçmişi tablosu
    c.execute('''CREATE TABLE IF NOT EXISTS chat_history
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, message TEXT, 
                  sender TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (user_id) REFERENCES users (id))''')
    
    conn.commit()
    conn.close()

def validate_email(email):
    """E-posta formatını doğrular"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def generate_verification_code():
    """6 haneli doğrulama kodu oluşturur"""
    return ''.join(random.choices(string.digits, k=6))

def send_email_verification(email, code):
    """E-posta doğrulama kodu gönderir - Kullanıcının verdiği fonksiyon"""
    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_SENDER
        msg['To'] = email
        msg['Subject'] = "Eraco Chatbot E-posta Doğrulama"
        
        body = f"""
        Merhaba,
        
        Eraco Chatbot e-posta doğrulama kodunuz: {code}
        
        Bu kodu kimseyle paylaşmayın.
        
        Saygılarımızla,
        Eraco Teknik Servis
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(EMAIL_SENDER, email, text)
        server.quit()
        
        return True, "E-posta gönderildi"
    except Exception as e:
        return False, f"E-posta gönderilemedi: {str(e)}"

def create_user(email):
    """Yeni kullanıcı oluşturur"""
    user_id = str(uuid.uuid4())
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    
    c.execute('INSERT INTO users (id, email) VALUES (?, ?)', (user_id, email))
    conn.commit()
    conn.close()
    
    return user_id

def save_verification_code(user_id, code):
    """Doğrulama kodunu kaydeder"""
    expires = datetime.now() + timedelta(minutes=10)  # 10 dakika geçerli
    
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    
    c.execute('''INSERT OR REPLACE INTO verification_codes 
                 (user_id, email_code, code_expires) VALUES (?, ?, ?)''', 
              (user_id, code, expires))
    
    conn.commit()
    conn.close()

def verify_email_code(user_id, code):
    """E-posta doğrulama kodunu kontrol eder - Kullanıcının verdiği fonksiyon"""
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    
    c.execute('SELECT email_code FROM verification_codes WHERE user_id = ? AND email_verified = FALSE', (user_id,))
    result = c.fetchone()
    
    if result and result[0] == code:
        c.execute('UPDATE verification_codes SET email_verified = TRUE WHERE user_id = ?', (user_id,))
        c.execute('UPDATE users SET email_verified = TRUE WHERE id = ?', (user_id,))
        conn.commit()
        conn.close()
        return True
    
    conn.close()
    return False

def verify_product(user_id, product_name, serial_number):
    """Ürün adı ve seri numarasını doğrular (garanti veri kaynağı üzerinden)."""
    import re
    
    rec, tuple_info = find_warranty_record(product_name, serial_number)
    if rec:
        # Kullanıcının ürün doğrulamasını kaydet
        conn = sqlite3.connect('chat_history.db')
        c = conn.cursor()
        c.execute('UPDATE users SET product_verified = TRUE WHERE id = ?', (user_id,))
        conn.commit()
        conn.close()
        # Döndürülecek ürün bilgisini normalize et
        name = rec.get('name') or rec.get('urun_adi') or rec.get('Ürün Adı') or product_name
        serial = rec.get('serial') or rec.get('seri_no') or rec.get('Seri No') or serial_number
        product = {'name': name, 'serial': serial}
        return True, product
    return False, None

def update_email_code(user_id, new_code):
    """E-posta kodunu günceller - Kullanıcının verdiği fonksiyon"""
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    c.execute('UPDATE verification_codes SET email_code = ? WHERE user_id = ?', (new_code, user_id))
    conn.commit()
    conn.close()

def save_chat_message(user_id, message, sender):
    """Chat mesajını kaydeder"""
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    
    c.execute('INSERT INTO chat_history (user_id, message, sender) VALUES (?, ?, ?)', 
              (user_id, message, sender))
    
    conn.commit()
    conn.close()

def get_user_chat_history(user_id):
    """Kullanıcının chat geçmişini getirir"""
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    
    c.execute('SELECT message, sender, timestamp FROM chat_history WHERE user_id = ? ORDER BY timestamp', (user_id,))
    history = c.fetchall()
    
    conn.close()
    return history

def check_user_verification(user_id):
    """Kullanıcının doğrulama durumunu kontrol eder"""
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    
    c.execute('SELECT email_verified, product_verified FROM users WHERE id = ?', (user_id,))
    result = c.fetchone()
    conn.close()
    
    if result:
        return {
            'email_verified': bool(result[0]),
            'product_verified': bool(result[1])
        }
    return None

@app.route('/api/register', methods=['POST'])
def register():
    """E-posta kaydı ve doğrulama kodu gönderimi"""
    data = request.get_json()
    email = data.get('email', '').strip()
    
    if not email:
        return jsonify({'success': False, 'message': 'E-posta adresi gerekli'}), 400
    
    if not validate_email(email):
        return jsonify({'success': False, 'message': 'Geçersiz e-posta formatı'}), 400
    
    try:
        # Kullanıcı oluştur
        user_id = create_user(email)
        
        # Doğrulama kodu oluştur ve gönder
        code = generate_verification_code()
        save_verification_code(user_id, code)
        
        # E-posta gönder
        success, message = send_email_verification(email, code)
        
        if success:
            return jsonify({
                'success': True, 
                'message': 'Doğrulama kodu e-posta adresinize gönderildi',
                'user_id': user_id
            })
        else:
            return jsonify({'success': False, 'message': message}), 500
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'Hata: {str(e)}'}), 500

@app.route('/api/verify', methods=['POST'])
def verify():
    """E-posta doğrulama"""
    data = request.get_json()
    user_id = data.get('user_id')
    code = data.get('code', '').strip()
    
    if not user_id or not code:
        return jsonify({'success': False, 'message': 'Kullanıcı ID ve doğrulama kodu gerekli'}), 400
    
    if verify_email_code(user_id, code):
        return jsonify({'success': True, 'message': 'E-posta başarıyla doğrulandı'})
    else:
        return jsonify({'success': False, 'message': 'Geçersiz veya süresi dolmuş kod'}), 400

@app.route('/api/verify-product', methods=['POST'])
def verify_product_endpoint():
    """Ürün doğrulama"""
    try:
        data = request.get_json(silent=True) or {}
        user_id = data.get('user_id')
        product_name = (data.get('product_name') or '').strip()
        serial_number = (data.get('serial_number') or '').strip()
        
        if not user_id or not product_name or not serial_number:
            return jsonify({'success': False, 'message': 'Kullanıcı ID, ürün adı ve seri numarası gerekli'}), 400
        
        # Önce e-posta doğrulamasını kontrol et
        verification = check_user_verification(user_id)
        if not verification or not verification['email_verified']:
            return jsonify({'success': False, 'message': 'Önce e-posta adresinizi doğrulayın'}), 403
        
        success, product = verify_product(user_id, product_name, serial_number)
        
        if success:
            return jsonify({
                'success': True, 
                'message': 'Ürün doğrulaması başarılı',
                'product': product
            })
        else:
            return jsonify({'success': False, 'message': 'Ürün adı veya seri numarası hatalı'}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Sunucu hatası: {str(e)}'}), 500



@app.route('/api/chat', methods=['POST'])
def chat():
    """Chat mesajı işleme"""
    data = request.get_json()
    user_id = data.get('user_id')
    message = data.get('message', '').strip()
    
    if not user_id or not message:
        return jsonify({'success': False, 'message': 'Kullanıcı ID ve mesaj gerekli'}), 400
    
    # Kullanıcının tüm doğrulamalarını kontrol et
    verification = check_user_verification(user_id)
    if not verification:
        return jsonify({'success': False, 'message': 'Kullanıcı bulunamadı'}), 404
    
    if not verification['email_verified']:
        return jsonify({'success': False, 'message': 'Önce e-posta adresinizi doğrulayın'}), 403
    
    if not verification['product_verified']:
        return jsonify({'success': False, 'message': 'Önce ürün doğrulamasını tamamlayın'}), 403
    
    # Mesajı kaydet
    save_chat_message(user_id, message, 'user')
    
    # Bot yanıtı oluştur
    bot_response = generate_bot_response(message)
    save_chat_message(user_id, bot_response, 'bot')
    
    return jsonify({
        'success': True,
        'response': bot_response
    })

@app.route('/api/status/<user_id>', methods=['GET'])
def get_user_status(user_id):
    """Kullanıcının doğrulama durumunu getirir"""
    verification = check_user_verification(user_id)
    if verification:
        return jsonify({
            'success': True,
            'email_verified': verification['email_verified'],
            'product_verified': verification['product_verified']
        })
    else:
        return jsonify({'success': False, 'message': 'Kullanıcı bulunamadı'}), 404

@app.route('/api/products', methods=['GET'])
def get_products():
    """Örnek ürün listesi gösterilmeyecek, boş dönüyoruz."""
    return jsonify({
        'success': True,
        'products': []
    })

@app.route('/api/history/<user_id>', methods=['GET'])
def get_history(user_id):
    """Chat geçmişini getir"""
    history = get_user_chat_history(user_id)
    return jsonify({
        'success': True,
        'history': [{'message': msg, 'sender': sender, 'timestamp': timestamp} 
                   for msg, sender, timestamp in history]
    })

def generate_bot_response(user_message):
    """Bot yanıtı oluşturur"""
    # Önce urun_hatalari.json içinden esnek eşleme ile hata arayın
    error = find_error_entry(user_message)
    if error:
        lines = []
        st_kodu = error.get('st542_kodu') or '-'
        carel_kodu = error.get('carel_kodu') or '-'
        plc_ekran = error.get('plc_ekran') or ''
        aciklama = error.get('aciklama') or ''
        sebep = error.get('sebep') or ''
        yorum_listesi = error.get('yorum') or []

        header = plc_ekran
        if header:
            header += f" ({st_kodu} / {carel_kodu})"
        else:
            header = f"Hata Bilgisi ({st_kodu} / {carel_kodu})"
        lines.append(header)
        if aciklama:
            lines.append(f"Açıklama: {aciklama}")
        if sebep:
            lines.append(f"Sebep: {sebep}")
        if yorum_listesi:
            lines.append("Öneriler:")
            for y in yorum_listesi:
                lines.append(f"- {y}")
        return "\n".join(lines)

    lower_message = user_message.lower()
    
    if 'merhaba' in lower_message or 'selam' in lower_message:
        return 'Merhaba! Size nasıl yardımcı olabilirim? 😊'
    elif 'ürün' in lower_message or 'hizmet' in lower_message:
        return 'Ürünlerimiz hakkında detaylı bilgi almak için web sitemizi ziyaret edebilir veya bizimle iletişime geçebilirsiniz. Hangi ürün hakkında bilgi almak istiyorsunuz?'
    elif 'fiyat' in lower_message or 'ücret' in lower_message:
        return 'Fiyat bilgileri için lütfen bizimle iletişime geçin. Size en uygun fiyat teklifini sunmaktan memnuniyet duyarız. 📞'
    elif 'iletişim' in lower_message or 'telefon' in lower_message or 'email' in lower_message:
        return 'Bizimle iletişime geçmek için:\n📞 Telefon: +90 555 123 45 67\n📧 Email: info@eracochillers.com\n📍 Adres: İstanbul, Türkiye'
    elif 'teşekkür' in lower_message or 'sağol' in lower_message:
        return 'Rica ederim! Başka bir konuda yardıma ihtiyacınız olursa çekinmeden sorabilirsiniz. 😊'
    elif 'görüşürüz' in lower_message or 'hoşça kal' in lower_message:
        return 'Görüşmek üzere! İyi günler dilerim. 👋'
    else:
        responses = [
            'Anlıyorum, size daha iyi yardımcı olabilmem için biraz daha detay verebilir misiniz?',
            'Bu konuda size yardımcı olmaktan memnuniyet duyarım. Hangi konuda bilgi almak istiyorsunuz?',
            'Harika bir soru! Bu konuda uzman ekibimizle görüşmenizi öneririm.',
            'Size en iyi hizmeti sunmak için buradayız. Başka bir konuda yardıma ihtiyacınız var mı?',
            'Bu konuda size detaylı bilgi verebilirim. Hangi özellik hakkında daha fazla bilgi almak istiyorsunuz?'
        ]
        return random.choice(responses)

if __name__ == '__main__':
    init_database()
    print("Chatbot sunucusu başlatılıyor...")
    print("E-posta ayarları:")
    print(f"Gönderen: {EMAIL_SENDER}")
    print(f"Alıcı: {EMAIL_RECEIVER}")
    app.run(debug=True, port=5000) 