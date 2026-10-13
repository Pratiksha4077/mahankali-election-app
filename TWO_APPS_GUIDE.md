# Mahankali Election System — Two Interconnected Applications

या प्रोजेक्टचे यशस्वीरित्या दोन स्वतंत्र परंतु एकमेकांशी पूर्णपणे जोडलेल्या (Interconnected) ॲप्लिकेशन्समध्ये विभाजन करण्यात आले आहे:

1. 🛡️ **Mahankali Admin App** (`admin-app/`) — ॲडमिनिस्ट्रेटरसाठी
2. 📱 **Mahankali User App** (`user-app/`) — फील्ड कार्यकर्ते व मतदारांसाठी
3. ⚙️ **Shared FastAPI Backend** (`backend/`) — एकच सामायिक बॅकएंड आणि MongoDB Atlas डेटाबेस

---

## १. Architecture & Interconnection (कसे जोडलेले आहेत?)

```
+---------------------------------------+       +---------------------------------------+
|        1. Mahankali Admin App         |       |         2. Mahankali User App         |
|         (com.mahankali.admin)         |       |        (com.mahankali.voters)         |
|  - युझर्स व्यवस्थापन (Create/Disable) |       |  - मतदार शोध (Marathi/English)       |
|  - मतदार Excel/PDF डेटा अपलोड         |       |  - कुटुंब व्यवस्थापन (Family Head)    |
|  - अहवाल व आकडेवारी (12 Reports)     |       |  - मतदार माहिती संपादन / वर्गवारी      |
|  - कार्यकर्त्यांच्या हालचाली ट्रॅकिंग |       |  - फील्ड व्हिजिट, कॉल, एसएमएस         |
|  - शून्य अनावश्यक परवानग्या           |       |  - फील्ड परवानग्या (Location/Telephony)|
+-------------------+-------------------+       +-------------------+-------------------+
                    |                                               |
                    | (REST APIs via JWT)                           | (REST APIs via JWT)
                    v                                               v
+---------------------------------------------------------------------------------------+
|                                One Shared FastAPI Backend                             |
|                               (http://localhost:8000/api)                             |
|                         (https://mahankali-election-app.onrender.com/api)             |
|                                                                                       |
|   - Authentication & Role Guards (ADMIN vs USER)                                      |
|   - Real-time Account Status (सक्रिय / निष्क्रिय युझर तपासणी)                         |
|   - Audit Logging & Activity Sync                                                     |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|                               Shared MongoDB Atlas Database                           |
|                      Collections: users, members, families, audit_logs                |
+---------------------------------------------------------------------------------------+
```

---

## २. Interconnection Workflow (डेटाचा ताळमेळ कसा होतो?)

1. **युझर खाती व्यवस्थापन (User Management):**
   - **Admin App** मध्ये ॲडमिन नवीन युझर (कार्यकर्ता) तयार करतो आणि त्याला गाव वाटून देतो.
   - तो कार्यकर्ता **User App** मध्ये स्वतःच्या युझरनेम व पासवर्डने लगेच लॉगिन करू शकतो.
   - ॲडमिनने एखाद्या युझरला डिसेबल (Disable) केल्यास, **User App** मध्ये त्याला लगेच प्रवेश नाकारला जातो (`403 Forbidden: ॲडमिनने आपला प्रवेश नाकारला आहे`).

2. **मतदार डेटा अपलोड व शोध (Voter Upload & Search):**
   - **Admin App** मधून Excel किंवा PDF फाईल अपलोड केली जाते.
   - बॅकएंड ती फाईल प्रोसेस करून MongoDB मध्ये सेव्ह करतो.
   - **User App** रिफ्रेश करताच कार्यकर्त्यांना सर्व नवीन मतदार त्वरित दिसतात.

3. **फील्ड अपडेट्स व रिपोर्ट विश्लेषण (Field Updates & Analytics):**
   - **User App** मध्ये कार्यकर्त्याने मतदाराचा फोन नंबर बदलला, कुटुंब प्रमुख निवडला किंवा अनुकूल/प्रतिकूल वर्गवारी केली.
   - **Admin App** मधील डॅशबोर्डवर ती आकडेवारी व ऑडिट लॉग्स त्वरित अपडेट होतात.

---

## ३. ॲप्स कसे चालवायचे? (How to Run)

### पायरी १: बॅकएंड सर्व्हर सुरू करा
डबल क्लिक करा:
👉 `start_backend.bat`
*(स्थानिक Dev URL: `http://localhost:8000` | Swagger API: `http://localhost:8000/docs`)*

### पायरी २: Admin App सुरू करा (Port 8081)
डबल क्लिक करा:
👉 `start_admin_app.bat`

### पायरी ३: User App सुरू करा (Port 8082)
डबल क्लिक करा:
👉 `start_user_app.bat`

*(टीप: दोन्ही ॲप्स एकाच वेळी वेगवेगळ्या पोर्टवर (8081 आणि 8082) चालू शकतात.)*

---

## ४. स्वतंत्र APK फाइल्स कशा तयार करायच्या? (Build APKs)

तुम्ही खालील स्वतंत्र बॅच फाइल्स वापरू शकता:

- 👉 `build_admin_apk.bat` — **Mahankali Admin APK** तयार करण्यासाठी (`com.mahankali.admin`)
- 👉 `build_user_apk.bat` — **Mahankali User APK** तयार करण्यासाठी (`com.mahankali.voters`)
- 👉 `build_apk.bat` — मेन्यूमधून निवडण्यासाठी (1 for Admin, 2 for User)

---

## ५. Performance व Security सुधारणा

1. **Admin App:**
   - Call log आणि SMS परवानग्या पूर्णपणे हटवल्या.
   - Cold startup वेगवान झाला (फक्त ॲडमिन स्क्रीन्स लोड होतात).
   - Google Play Store च्या पॉलिसीनुसार १००% सुरक्षित.

2. **User App:**
   - डेटा अपलोड आणि भारी ॲडमिन टेबल्स हटवल्यामुळे ॲपचा आकार आणि RAM वापर कमी झाला.
   - साध्या आणि स्वस्त मोबाईलवरही जलद चालतो.
