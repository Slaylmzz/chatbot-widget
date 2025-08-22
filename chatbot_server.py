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
import requests
from datetime import datetime, timedelta

# OpenAI Assistant API
import os
from openai import OpenAI

app = Flask(__name__)
CORS(app)

# OpenAI config
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
# Dosyadan anahtar geri dönüşü (openai.key)
if not OPENAI_API_KEY:
    try:
        with open('openai.key', 'r', encoding='utf-8') as _f:
            OPENAI_API_KEY = _f.read().strip()
    except Exception:
        OPENAI_API_KEY = ''
OPENAI_ASSISTANT_ID = os.getenv('OPENAI_ASSISTANT_ID', 'asst_mfvwKHq9IHQycz7HV8ebWeDf')
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

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
    # Kullanıcı mesajından kodları çıkar (ER21, AL003, ER 05 gibi boşluklu haller dahil)
    code_tokens_in_query = [t.lower() for t in re.findall(r'[a-zA-Z]+\s*\d+', query)]
    code_tokens_in_query = [re.sub(r'\s+', '', t) for t in code_tokens_in_query]

    for err in errors:
        st_code_raw = (err.get('st542_kodu') or '').strip()
        carel_code_raw = (err.get('carel_kodu') or '').strip()

        # "ER05 / ER06" gibi değerleri tek tek tokenlara ayır
        st_tokens = [t.lower() for t in re.findall(r'[a-zA-Z]+\d+', st_code_raw.replace(' ', ''))]
        carel_tokens = [t.lower() for t in re.findall(r'[a-zA-Z]+\d+', carel_code_raw.replace(' ', ''))]

        if code_tokens_in_query:
            for qtok in code_tokens_in_query:
                if qtok in st_tokens or qtok in carel_tokens:
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
                 (id TEXT PRIMARY KEY, email TEXT UNIQUE, email_verified BOOLEAN DEFAULT FALSE, 
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
    
    # Teknik servis talepleri tablosu
    c.execute('''CREATE TABLE IF NOT EXISTS technical_service_requests
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, name TEXT, phone TEXT,
                  email TEXT, address TEXT, problem_description TEXT, preferred_date TEXT,
                  location_lat REAL, location_lon REAL, location_address TEXT, ip_address TEXT,
                  warranty_status TEXT, warranty_end_date TEXT, product_name TEXT, serial_number TEXT,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    """Yeni kullanıcı oluşturur veya mevcut kullanıcının ID'sini döndürür"""
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    
    # Önce bu email ile kayıtlı kullanıcı var mı kontrol et
    c.execute('SELECT id FROM users WHERE email = ?', (email,))
    existing_user = c.fetchone()
    
    if existing_user:
        conn.close()
        print(f"Mevcut kullanıcı bulundu: {email} -> {existing_user[0]}")
        return existing_user[0]
    
    # Yeni kullanıcı oluştur
    user_id = str(uuid.uuid4())
    try:
        c.execute('INSERT INTO users (id, email) VALUES (?, ?)', (user_id, email))
        conn.commit()
        print(f"Yeni kullanıcı oluşturuldu: {email} -> {user_id}")
    except sqlite3.IntegrityError:
        # Eğer UNIQUE constraint hatası alırsak, tekrar kontrol et
        c.execute('SELECT id FROM users WHERE email = ?', (email,))
        existing_user = c.fetchone()
        if existing_user:
            conn.close()
            return existing_user[0]
        else:
            conn.close()
            raise Exception("Kullanıcı oluşturulamadı")
    
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

def is_product_technical_question(message: str) -> bool:
    """Ürünlerin teknik detaylarına dair soruları tespit eder; bu durumda OpenAI devre dışı kalır.
    Sadece açık teknik terimler/kodlar tetikler; genel sorular (konum/iletişim vb.) tetiklemez.
    """
    text = (message or '').lower()
    # Hata kodu kalıpları ve teknik anahtarlar
    code_hit = bool(re.search(r"\b(er\s*\d{2,3}|al\s*\d{2,3})\b", text))
    hard_keywords = [
        'yüksek basınç', 'alçak basınç', 'kompresör', 'pompa', 'fan', 'genleşme', 'kondenser',
        'evaparatör', 'yağ', 'akım', 'sensör', 'parametre', 'alarm', 'termostat', 'flow', 'debisi',
        'switch', 'valf', 'soğutucu', 'r134', 'r410', 'gaz'
    ]
    token_hit = any(k in text for k in hard_keywords)
    return code_hit or token_hit

def is_low_information_message(message: str) -> bool:
    """Kullanıcının mesajı anlamı belirsiz/kısa ise True döner."""
    if not message:
        return True
    text = message.strip().lower()
    if len(text) < 3:
        return True
    # Sadece noktalama veya soru imleri
    if re.fullmatch(r"[\.?!,\-\s]+", text or ""):
        return True
    low_tokens = [
        'bilmiyorum', 'bilmiyom', 'bilmiyom', 'bilmiyem', 'bılemem', 'bilemedim',
        'emin değilim', 'bence', 'kararsızım', 'yardım', 'bilmiyo', 'ne yapmalıyım',
    ]
    return any(tok in text for tok in low_tokens)


def ask_openai_assistant(user_message: str) -> str:
    """OpenAI Assistant API ile genel, gündelik konuşma yanıtı üretir. Teknik konuları yanıtlamaz."""
    if not openai_client or not OPENAI_ASSISTANT_ID:
        return 'OpenAI Assistant yapılandırılmadı.'

    guard_instruction = (
        "Sen bir müşteri destek asistanısın. Ürünlerin teknik detayları, arıza/hata kodları, bakım, servis,"
        " elektriksel/mekanik yönlendirmeler hakkında yanıt verme; bu konularda kullanıcıyı teknik servise yönlendir."
        " Sadece gündelik konuşmalar, selamlama, iletişim, çalışma saatleri, marka tanıtımı gibi konularda yardımcı ol."
    )

    try:
        thread = openai_client.beta.threads.create()
        openai_client.beta.threads.messages.create(
            thread_id=thread.id,
            role='user',
            content=f"[Kural: {guard_instruction}]\nKullanıcı: {user_message}"
        )
        run = openai_client.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=OPENAI_ASSISTANT_ID,
        )
        # Basit polling
        import time
        while True:
            run_status = openai_client.beta.threads.runs.retrieve(
                thread_id=thread.id,
                run_id=run.id
            )
            if run_status.status == 'completed':
                break
            if run_status.status in ['failed', 'cancelled', 'expired']:
                return f'OpenAI Assistant çalıştırma durumu: {run_status.status}'
            time.sleep(0.8)
        messages = openai_client.beta.threads.messages.list(thread_id=thread.id)
        for msg in reversed(messages.data):
            if msg.role == 'assistant':
                parts = []
                for c in msg.content:
                    if hasattr(c, 'text') and hasattr(c.text, 'value'):
                        parts.append(c.text.value)
                if parts:
                    return ' '.join(parts)
        return 'OpenAI Assistant yanıtı alınamadı.'
    except Exception as e:
        return f'OpenAI Assistant hatası: {e}'

def get_location_from_ip(ip_address):
    """IP adresinden konum bilgisi alır"""
    if ip_address == "IP Bilinmiyor" or ip_address == "127.0.0.1" or not ip_address:
        return "Yerel/Bilinmiyor"
    try:
        response = requests.get(f"https://ipinfo.io/{ip_address}/json", timeout=5)
        response.raise_for_status()
        data = response.json()
        
        city = data.get('city', '')
        region = data.get('region', '')
        country = data.get('country', '')
        
        location_parts = [part for part in [city, region, country] if part]
        return ", ".join(location_parts) if location_parts else "Bilinmiyor"
    except requests.exceptions.RequestException as e:
        return "Bilinmiyor (Ağ Hatası)"
    except Exception as e:
        return "Bilinmiyor (Genel Hata)"

def get_city_from_latlon(lat, lon):
    """Koordinatlardan şehir bilgisi alır"""
    try:
        url = f"https://nominatim.openstreetmap.org/reverse"
        params = {
            "lat": lat,
            "lon": lon,
            "format": "json",
            "zoom": 10,
            "addressdetails": 1
        }
        headers = {
            "User-Agent": "eraco-chatbot/1.0"
        }
        response = requests.get(url, params=params, headers=headers, timeout=5)
        response.raise_for_status()
        data = response.json()
        address = data.get("address", {})
        
        city = address.get("city") or address.get("town") or address.get("village") or address.get("county")
        state = address.get("state")
        country = address.get("country")
        
        result = ", ".join([x for x in [city, state, country] if x])
        return result if result else "Bilinmiyor"
    except Exception as e:
        return f"Bilinmiyor ({e})"

def get_user_product_info(user_id):
    """Kullanıcının doğrulanmış ürün bilgilerini getirir"""
    conn = sqlite3.connect('chat_history.db')
    c = conn.cursor()
    
    # Bu örnekte, kullanıcının doğruladığı ürün bilgilerini chat_history'den çekiyoruz
    # Gerçek uygulamada ayrı bir tablo kullanılabilir
    c.execute('SELECT message FROM chat_history WHERE user_id = ? AND sender = "system" AND message LIKE "Ürün doğrulandı:%"', (user_id,))
    result = c.fetchone()
    conn.close()
    
    if result:
        # "Ürün doğrulandı: ER.A-S 702, 2014-4013" formatından parse et
        parts = result[0].replace("Ürün doğrulandı: ", "").split(", ")
        if len(parts) >= 2:
            return {"product_name": parts[0], "serial_number": parts[1]}
    
    return None

def send_technical_service_email(service_data, warranty_info):
    """Teknik servis talebini e-posta ile gönderir"""
    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_SENDER
        msg['To'] = EMAIL_RECEIVER
        msg['Subject'] = f"Teknik Servis Talebi - {service_data['name']}"
        
        # E-posta içeriği
        body = f"""
        YENİ TEKNİK SERVİS TALEBİ
        
        MÜŞTERİ BİLGİLERİ:
        Ad Soyad: {service_data['name']}
        Firma Adı: {service_data.get('company_name', 'Belirtilmemiş')}
        Telefon Numarası: {service_data['phone']}
        E-posta Adresi: {service_data['email']}
        Adres: {service_data['address']}
        Talep Tarihi: {service_data.get('request_date', 'Belirtilmemiş')}
        
        CİHAZ BİLGİLERİ:
        Cihaz Modeli: {service_data.get('device_model', 'Belirtilmemiş')}
        Seri Numarası: {service_data.get('serial_number', 'Belirtilmemiş')}
        Cihazın Konumu (Açık-Kapalı liste: Açık): {service_data.get('device_location', 'Belirtilmemiş')}
        Arıza Kodu (Varsa): {service_data.get('error_code', 'Belirtilmemiş')}
        Ekrandaki Hata Mesajı: {service_data.get('current_error', 'Belirtilmemiş')}
        
        Garanti Durumu: {warranty_info.get('warranty_status', 'Bilinmiyor')}
        Garanti Bitiş Tarihi: {warranty_info.get('warranty_end_date', 'Bilinmiyor')}
        
        SORUN AÇIKLAMASI:
        {service_data['problem_description']}
        
        TERCİH EDİLEN SERVİS TARİHİ:
        {service_data.get('preferred_date', 'Belirtilmemiş')}
        
        EK NOTLAR / YORUMLAR:
        {service_data.get('additional_notes', 'Belirtilmemiş')}
        
        KONUM BİLGİSİ:
        Ferizli, Türkiye
        IP Adresi: {service_data.get('ip_address', 'Bilinmiyor')}
        
        TALEP TARİHİ:
        {service_data.get('timestamp', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))}
        
        Bu talep otomatik olarak oluşturulmuştur.
        """
        
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(EMAIL_SENDER, EMAIL_RECEIVER, text)
        server.quit()
        
        return True, "E-posta gönderildi"
    except Exception as e:
        return False, f"E-posta gönderilemedi: {str(e)}"


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
        
        # Özel e-posta adresi için de kod gönder (otomatik doğrulama kaldırıldı)
        # if email.lower() == 'sila.yilmazz.0789@gmail.com':
        #     # Doğrudan e-posta doğrulamasını tamamla
        #     conn = sqlite3.connect('chat_history.db')
        #     c = conn.cursor()
        #     c.execute('UPDATE users SET email_verified = TRUE WHERE id = ?', (user_id,))
        #     c.execute('INSERT OR REPLACE INTO verification_codes (user_id, email_verified) VALUES (?, TRUE)', (user_id,))
        #     conn.commit()
        #     conn.close()
        #     
        #     return jsonify({
        #         'success': True, 
        #         'message': 'E-posta otomatik olarak doğrulandı',
        #         'user_id': user_id,
        #         'auto_verified': True
        #     })
        
        # Diğer e-postalar için normal doğrulama
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
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'JSON verisi gerekli'}), 400
            
        user_id = data.get('user_id')
        code = data.get('code', '').strip()
        
        print(f"Doğrulama isteği - User ID: {user_id}, Code: {code}")
        
        if not user_id or not code:
            return jsonify({'success': False, 'message': 'Kullanıcı ID ve doğrulama kodu gerekli'}), 400
        
        if verify_email_code(user_id, code):
            return jsonify({'success': True, 'message': 'E-posta başarıyla doğrulandı'})
        else:
            return jsonify({'success': False, 'message': 'Geçersiz veya süresi dolmuş kod'}), 400
    except Exception as e:
        print(f"Verify endpoint hatası: {str(e)}")
        return jsonify({'success': False, 'message': f'Server hatası: {str(e)}'}), 500

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
    
    # 0) Düşük bilgi ise hemen netleştirici yanıt ver
    if is_low_information_message(message):
        bot_response = (
            "Size doğru yardımcı olabilmem için lütfen konuyu biraz netleştirir misiniz?\n"
            "Örnekler: 'ER21 hatası', 'Yüksek basınç alarmı', 'İletişim bilgileri', 'Servis talebi'"
        )
        save_chat_message(user_id, bot_response, 'bot')
        return jsonify({'success': True, 'response': bot_response})

    # 1) Hata kodları/teknik içerik → yerel bilgi tabanı
    bot_response = None
    tech_hit = find_error_entry(message)
    if tech_hit:
        lines = []
        st_kodu = tech_hit.get('st542_kodu') or '-'
        carel_kodu = tech_hit.get('carel_kodu') or '-'
        plc_ekran = tech_hit.get('plc_ekran') or ''
        aciklama = tech_hit.get('aciklama') or ''
        sebep = tech_hit.get('sebep') or ''
        yorum_listesi = tech_hit.get('yorum') or []
        header = plc_ekran or 'Hata Bilgisi'
        header += f" ({st_kodu} / {carel_kodu})"
        lines.append(header)
        if aciklama:
            lines.append(f"Açıklama: {aciklama}")
        if sebep:
            lines.append(f"Sebep: {sebep}")
        if yorum_listesi:
            lines.append("Öneriler:")
            for y in yorum_listesi:
                lines.append(f"- {y}")
        bot_response = "\n".join(lines)

    # 2) Teknik değilse ve OpenAI yapılandırıldıysa Assistant'a yönlendir
    if bot_response is None and not is_product_technical_question(message):
        if openai_client:
            bot_response = ask_openai_assistant(message)

    # 3) Hala yoksa deterministik fallback
    if bot_response is None:
        bot_response = (
            "Anladım; daha net yardımcı olabilmem için lütfen şu biçimde yazın: 'ER05', 'Pompa aşırı yük', 'İletişim bilgileri'."
        )

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

# Admin API endpoints
@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    """Admin paneli için istatistikleri getirir"""
    try:
        conn = sqlite3.connect('chat_history.db')
        c = conn.cursor()
        
        # Toplam kullanıcı sayısı
        c.execute('SELECT COUNT(*) FROM users')
        total_users = c.fetchone()[0]
        
        # Toplam mesaj sayısı
        c.execute('SELECT COUNT(*) FROM chat_history')
        total_messages = c.fetchone()[0]
        
        # Servis talepleri
        c.execute('SELECT COUNT(*) FROM technical_service_requests')
        service_requests = c.fetchone()[0]
        
        # Bugün aktif kullanıcılar
        c.execute("SELECT COUNT(DISTINCT user_id) FROM chat_history WHERE DATE(timestamp) = DATE('now')")
        today_users = c.fetchone()[0]
        
        # Günlük aktivite (son 7 gün)
        c.execute("""
            SELECT DATE(timestamp) as date, COUNT(DISTINCT user_id) as users 
            FROM chat_history 
            WHERE timestamp >= datetime('now', '-7 days')
            GROUP BY DATE(timestamp)
            ORDER BY date
        """)
        daily_activity = [{'date': row[0], 'users': row[1]} for row in c.fetchall()]
        
        # En çok sorulan konular (mesaj içeriğine göre basit analiz)
        c.execute("""
            SELECT message, COUNT(*) as count
            FROM chat_history 
            WHERE sender = 'user' AND LENGTH(message) > 10
            GROUP BY LOWER(SUBSTR(message, 1, 20))
            ORDER BY count DESC
            LIMIT 5
        """)
        top_topics = [{'topic': row[0][:20] + '...', 'count': row[1]} for row in c.fetchall()]
        
        conn.close()
        
        return jsonify({
            'totalUsers': total_users,
            'totalMessages': total_messages,
            'serviceRequests': service_requests,
            'todayUsers': today_users,
            'dailyActivity': daily_activity,
            'topTopics': top_topics
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users', methods=['GET'])
def get_admin_users():
    """Admin paneli için kullanıcı listesini getirir"""
    try:
        filter_type = request.args.get('filter', 'all')
        
        conn = sqlite3.connect('chat_history.db')
        c = conn.cursor()
        
        query = """
            SELECT u.id, u.email, u.email_verified, u.product_verified, u.created_at,
                   MAX(ch.timestamp) as last_activity
            FROM users u
            LEFT JOIN chat_history ch ON u.id = ch.user_id
        """
        
        if filter_type == 'verified':
            query += " WHERE u.email_verified = 1 AND u.product_verified = 1"
        elif filter_type == 'unverified':
            query += " WHERE u.email_verified = 0 OR u.product_verified = 0"
            
        query += " GROUP BY u.id ORDER BY u.created_at DESC"
        
        c.execute(query)
        users = []
        for row in c.fetchall():
            # IP'den konum bilgisi almaya çalış
            location = "Bilinmiyor"
            try:
                c.execute('SELECT ip_address FROM technical_service_requests WHERE user_id = ? LIMIT 1', (row[0],))
                ip_result = c.fetchone()
                if ip_result and ip_result[0]:
                    location = get_location_from_ip(ip_result[0])
            except:
                pass
                
            users.append({
                'id': row[0],
                'email': row[1],
                'email_verified': bool(row[2]),
                'product_verified': bool(row[3]),
                'created_at': row[4],
                'last_activity': row[5],
                'location': location
            })
        
        conn.close()
        return jsonify(users)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/chats', methods=['GET'])
def get_admin_chats():
    """Admin paneli için sohbet geçmişini getirir"""
    try:
        filter_type = request.args.get('filter', 'all')
        date_filter = request.args.get('date', '')
        
        conn = sqlite3.connect('chat_history.db')
        c = conn.cursor()
        
        query = """
            SELECT u.email, ch.user_id, MAX(ch.timestamp) as last_message_time
            FROM chat_history ch
            JOIN users u ON ch.user_id = u.id
        """
        
        conditions = []
        if filter_type == 'today':
            conditions.append("DATE(ch.timestamp) = DATE('now')")
        elif filter_type == 'week':
            conditions.append("ch.timestamp >= datetime('now', '-7 days')")
        
        if date_filter:
            conditions.append(f"DATE(ch.timestamp) = '{date_filter}'")
            
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
            
        query += " GROUP BY ch.user_id ORDER BY last_message_time DESC LIMIT 20"
        
        c.execute(query)
        chat_users = c.fetchall()
        
        chats = []
        for user_email, user_id, last_time in chat_users:
            # Bu kullanıcının son mesajlarını al
            c.execute("""
                SELECT message, sender, timestamp 
                FROM chat_history 
                WHERE user_id = ? 
                ORDER BY timestamp DESC 
                LIMIT 10
            """, (user_id,))
            
            messages = [{
                'message': msg[0][:100] + ('...' if len(msg[0]) > 100 else ''),
                'sender': msg[1],
                'timestamp': msg[2]
            } for msg in c.fetchall()]
            
            chats.append({
                'user_email': user_email,
                'user_id': user_id,
                'last_message_time': last_time,
                'messages': list(reversed(messages))
            })
        
        conn.close()
        return jsonify(chats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/service-requests', methods=['GET'])
def get_admin_service_requests():
    """Admin paneli için servis taleplerini getirir"""
    try:
        status_filter = request.args.get('status', 'all')
        
        conn = sqlite3.connect('chat_history.db')
        c = conn.cursor()
        
        query = """
            SELECT tsr.*, u.email
            FROM technical_service_requests tsr
            JOIN users u ON tsr.user_id = u.id
            ORDER BY tsr.created_at DESC
        """
        
        c.execute(query)
        requests = []
        for row in c.fetchall():
            requests.append({
                'id': row[0],
                'user_id': row[1],
                'name': row[2],
                'phone': row[3],
                'email': row[4],
                'address': row[5],
                'problem_description': row[6],
                'preferred_date': row[7],
                'location_lat': row[8],
                'location_lon': row[9],
                'location_address': row[10],
                'ip_address': row[11],
                'warranty_status': row[12],
                'warranty_end_date': row[13],
                'product_name': row[14],
                'serial_number': row[15],
                'created_at': row[16],
                'user_email': row[17]
            })
        
        conn.close()
        return jsonify(requests)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/analytics', methods=['GET'])
def get_admin_analytics():
    """Admin paneli için analitik verilerini getirir"""
    try:
        conn = sqlite3.connect('chat_history.db')
        c = conn.cursor()
        
        # Konum dağılımı
        c.execute("""
            SELECT location_address, COUNT(*) as count
            FROM technical_service_requests 
            WHERE location_address IS NOT NULL AND location_address != ''
            GROUP BY location_address
            ORDER BY count DESC
            LIMIT 10
        """)
        locations = [{'location': row[0] or 'Bilinmiyor', 'count': row[1]} for row in c.fetchall()]
        
        # Sık sorulan sorular
        c.execute("""
            SELECT message, COUNT(*) as count
            FROM chat_history 
            WHERE sender = 'user' AND LENGTH(message) > 5
            GROUP BY LOWER(message)
            HAVING count > 1
            ORDER BY count DESC
            LIMIT 10
        """)
        questions = [{'question': row[0][:50] + ('...' if len(row[0]) > 50 else ''), 'count': row[1]} for row in c.fetchall()]
        
        # Hata kodu analizi (mesajlardan hata kodlarını çıkar)
        c.execute("""
            SELECT message
            FROM chat_history 
            WHERE sender = 'user' AND (message LIKE '%ER%' OR message LIKE '%AL%')
        """)
        
        error_codes = {}
        for row in c.fetchall():
            message = row[0].upper()
            # ER ve AL kodlarını bul
            import re
            codes = re.findall(r'\b(ER\d{1,3}|AL\d{1,3})\b', message)
            for code in codes:
                error_codes[code] = error_codes.get(code, 0) + 1
        
        error_codes_list = [{'code': k, 'count': v} for k, v in sorted(error_codes.items(), key=lambda x: x[1], reverse=True)[:10]]
        
        conn.close()
        
        return jsonify({
            'locations': locations,
            'questions': questions,
            'errorCodes': error_codes_list
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/recent-activity', methods=['GET'])
def get_recent_activity():
    """Son aktiviteleri getirir"""
    try:
        conn = sqlite3.connect('chat_history.db')
        c = conn.cursor()
        
        activities = []
        
        # Son kullanıcı kayıtları
        c.execute("""
            SELECT email, created_at
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 5
        """)
        for row in c.fetchall():
            activities.append({
                'type': 'user_register',
                'title': 'Yeni Kullanıcı Kaydı',
                'description': f'{row[0]} sisteme kayıt oldu',
                'timestamp': row[1]
            })
        
        # Son servis talepleri
        c.execute("""
            SELECT tsr.name, tsr.created_at, u.email
            FROM technical_service_requests tsr
            JOIN users u ON tsr.user_id = u.id
            ORDER BY tsr.created_at DESC 
            LIMIT 5
        """)
        for row in c.fetchall():
            activities.append({
                'type': 'service_request',
                'title': 'Yeni Servis Talebi',
                'description': f'{row[0]} ({row[2]}) servis talebi oluşturdu',
                'timestamp': row[1]
            })
        
        # Aktiviteleri zamana göre sırala
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        
        conn.close()
        return jsonify(activities[:10])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/technical-service', methods=['POST'])
def submit_technical_service():
    """Teknik servis talebini işler"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'success': False, 'message': 'Kullanıcı ID gerekli'}), 400
        
        # Kullanıcının doğrulama durumunu kontrol et
        verification = check_user_verification(user_id)
        if not verification or not verification['email_verified'] or not verification['product_verified']:
            return jsonify({'success': False, 'message': 'Kullanıcı doğrulaması tamamlanmamış'}), 403
        
        # IP adresini al
        ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR', 'Bilinmiyor'))
        if ',' in ip_address:
            ip_address = ip_address.split(',')[0].strip()
        
        # Konum bilgilerini işle
        location_address = "Bilinmiyor"
        location_lat = None
        location_lon = None
        
        if data.get('location') and isinstance(data['location'], dict):
            location_lat = data['location'].get('latitude')
            location_lon = data['location'].get('longitude')
            if location_lat and location_lon:
                location_address = get_city_from_latlon(location_lat, location_lon)
        
        # Konum alınamazsa IP'den dene
        if location_address == "Bilinmiyor":
            location_address = get_location_from_ip(ip_address)
        
        # Kullanıcının ürün bilgilerini al
        product_info = get_user_product_info(user_id)
        warranty_info = {'warranty_status': 'Bilinmiyor', 'warranty_end_date': 'Bilinmiyor'}
        
        if product_info:
            # Garanti bilgilerini kontrol et
            rec, warranty_tuple = find_warranty_record(product_info['product_name'], product_info['serial_number'])
            if rec and warranty_tuple:
                purchase_dt, warranty_months = warranty_tuple
                warranty_status = compute_warranty_status(purchase_dt, warranty_months)
                warranty_info = {
                    'product_name': product_info['product_name'],
                    'serial_number': product_info['serial_number'],
                    'warranty_status': 'Garantili' if warranty_status['in_warranty'] else 'Garanti Süresi Dolmuş',
                    'warranty_end_date': warranty_status.get('ends_on', 'Bilinmiyor')
                }
        
        # Veritabanına kaydet
        conn = sqlite3.connect('chat_history.db')
        c = conn.cursor()
        
        c.execute('''
            INSERT INTO technical_service_requests 
            (user_id, name, company_name, phone, email, address, request_date, 
             device_model, serial_number, device_location, error_code, current_error,
             problem_description, preferred_date, additional_notes,
             location_lat, location_lon, location_address, ip_address, warranty_status, 
             warranty_end_date, product_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id, data.get('name'), data.get('company_name'), data.get('phone'), 
            data.get('email'), data.get('address'), data.get('request_date'),
            data.get('device_model'), data.get('serial_number'), data.get('device_location'),
            data.get('error_code'), data.get('current_error'), data.get('problem_description'),
            data.get('preferred_date'), data.get('additional_notes'),
            location_lat, location_lon, location_address, ip_address,
            warranty_info.get('warranty_status'), warranty_info.get('warranty_end_date'),
            warranty_info.get('product_name')
        ))
        
        conn.commit()
        conn.close()
        
        # E-posta gönder
        service_data = {
            'name': data.get('name'),
            'company_name': data.get('company_name'),
            'phone': data.get('phone'),
            'email': data.get('email'),
            'address': data.get('address'),
            'request_date': data.get('request_date'),
            'device_model': data.get('device_model'),
            'serial_number': data.get('serial_number'),
            'device_location': data.get('device_location'),
            'error_code': data.get('error_code'),
            'current_error': data.get('current_error'),
            'problem_description': data.get('problem_description'),
            'preferred_date': data.get('preferred_date'),
            'additional_notes': data.get('additional_notes'),
            'location_address': location_address,
            'ip_address': ip_address,
            'timestamp': data.get('timestamp')
        }
        
        email_success, email_message = send_technical_service_email(service_data, warranty_info)
        
        return jsonify({
            'success': True,
            'message': 'Teknik servis talebi başarıyla kaydedildi',
            'email_sent': email_success,
            'email_message': email_message
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Sunucu hatası: {str(e)}'}), 500

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

    # Düşük bilgi mesajları için standart netleştirici yanıt
    if is_low_information_message(lower_message):
        return (
            "Size doğru yardımcı olabilmem için lütfen konuyu biraz netleştirir misiniz?\n"
            "Örnekler: 'ER21 hatası', 'Yüksek basınç alarmı', 'İletişim bilgileri', 'Servis talebi'"
        )
    
    if 'merhaba' in lower_message or 'selam' in lower_message:
        return 'Merhaba! Size nasıl yardımcı olabilirim? 😊'
    elif 'ürün' in lower_message or 'hizmet' in lower_message:
        return 'Hangi ürün hakkında bilgi almak istiyorsunuz?'
    elif 'fiyat' in lower_message or 'ücret' in lower_message:
        return 'Fiyat bilgisi için ürün/model belirtir misiniz?'
    elif 'iletişim' in lower_message or 'telefon' in lower_message or 'email' in lower_message:
        return 'İletişim: 📞 +90 555 123 45 67 | 📧 info@eracochillers.com | 📍 İstanbul, Türkiye'
    elif 'görüşürüz' in lower_message or 'hoşça kal' in lower_message:
        return 'Görüşmek üzere! İyi günler dilerim. 👋'
    
    # Son fallback: tek tip açıklayıcı mesaj (rastgele cevap yok)
    return (
        "Anladım; daha net yardımcı olabilmem için lütfen şu biçimde yazın: 'ER05', 'Pompa aşırı yük', 'İletişim bilgileri'."
    )

@app.route('/')
def serve_chatbot():
    """Ana chatbot sayfasını sunar"""
    try:
        with open('chatbot-with-product-verification.html', 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return "Chatbot HTML dosyası bulunamadı", 404

@app.route('/chatbot-with-product-verification.html')
def serve_chatbot_direct():
    """Chatbot sayfasını doğrudan sunar"""
    try:
        with open('chatbot-with-product-verification.html', 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return "Chatbot HTML dosyası bulunamadı", 404

@app.route('/chatbot-with-product-verification.css')
def serve_css():
    """CSS dosyasını sunar"""
    try:
        with open('chatbot-with-product-verification.css', 'r', encoding='utf-8') as f:
            response = app.response_class(
                response=f.read(),
                status=200,
                mimetype='text/css'
            )
            return response
    except FileNotFoundError:
        return "CSS dosyası bulunamadı", 404

@app.route('/chatbot-with-product-verification.js')
def serve_js():
    """JavaScript dosyasını sunar"""
    try:
        with open('chatbot-with-product-verification.js', 'r', encoding='utf-8') as f:
            response = app.response_class(
                response=f.read(),
                status=200,
                mimetype='application/javascript'
            )
            return response
    except FileNotFoundError:
        return "JavaScript dosyası bulunamadı", 404

# JSON dosyalarını sunan route'lar
@app.route('/chiller_faq.json')
def serve_faq():
    """FAQ JSON dosyasını sunar"""
    try:
        with open('chiller_faq.json', 'r', encoding='utf-8') as f:
            response = app.response_class(
                response=f.read(),
                status=200,
                mimetype='application/json'
            )
            return response
    except FileNotFoundError:
        return "FAQ dosyası bulunamadı", 404

@app.route('/reset_instructions.json')
def serve_reset():
    """Reset talimatları JSON dosyasını sunar"""
    try:
        with open('reset_instructions.json', 'r', encoding='utf-8') as f:
            response = app.response_class(
                response=f.read(),
                status=200,
                mimetype='application/json'
            )
            return response
    except FileNotFoundError:
        return "Reset talimatları dosyası bulunamadı", 404

@app.route('/urun_hatalari.json')
def serve_errors():
    """Hata kodları JSON dosyasını sunar"""
    try:
        with open('urun_hatalari.json', 'r', encoding='utf-8') as f:
            response = app.response_class(
                response=f.read(),
                status=200,
                mimetype='application/json'
            )
            return response
    except FileNotFoundError:
        return "Hata kodları dosyası bulunamadı", 404

@app.route('/admin-panel.html')
def serve_admin_panel():
    """Admin panel HTML dosyasını sunar"""
    try:
        with open('admin-panel.html', 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return "Admin panel dosyası bulunamadı", 404

@app.route('/admin-login', methods=['POST'])
def admin_login():
    """Admin panel giriş kontrolü"""
    data = request.get_json()
    username = data.get('username', '')
    password = data.get('password', '')
    
    # Basit şifre kontrolü (gerçek uygulamada hash kullanın)
    ADMIN_USERNAME = "admin"
    ADMIN_PASSWORD = "eraco2024"
    
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        return jsonify({
            'success': True,
            'message': 'Giriş başarılı',
            'token': 'admin_authenticated'
        })
    else:
        return jsonify({
            'success': False,
            'message': 'Kullanıcı adı veya şifre hatalı'
        }), 401

@app.route('/admin-panel.css')
def serve_admin_css():
    """Admin panel CSS dosyasını sunar"""
    try:
        with open('admin-panel.css', 'r', encoding='utf-8') as f:
            response = app.response_class(
                response=f.read(),
                status=200,
                mimetype='text/css'
            )
            return response
    except FileNotFoundError:
        return "Admin panel CSS dosyası bulunamadı", 404

@app.route('/admin-panel.js')
def serve_admin_js():
    """Admin panel JavaScript dosyasını sunar"""
    try:
        with open('admin-panel.js', 'r', encoding='utf-8') as f:
            response = app.response_class(
                response=f.read(),
                status=200,
                mimetype='application/javascript'
            )
            return response
    except FileNotFoundError:
        return "Admin panel JavaScript dosyası bulunamadı", 404

if __name__ == '__main__':
    init_database()
    print("Chatbot sunucusu başlatılıyor...")
    print("E-posta ayarları:")
    print(f"Gönderen: {EMAIL_SENDER}")
    print(f"Alıcı: {EMAIL_RECEIVER}")
    app.run(debug=True, port=5000) 