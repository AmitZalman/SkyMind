# SkyMind v3.2.0 - הפעלה ותחזוקה

## 🚀 הפעלה מהירה

### הדרך המומלצת - שרת Python
```bash
cd skymind
python3 -m http.server 8000
```
פתח: http://localhost:8000

### אפשרות נוספת - Node.js
```bash
npx serve .
```

### אפשרות - Live Server (VS Code)
התקן את התוסף Live Server ולחץ "Go Live"

### מצב file:// (בלי שרת)
פתח את index.html ישירות בדפדפן. האפליקציה תציג כפתור לטעינת קובץ שאלות.

---

## 🔄 איפוס Cache ו-Service Worker

### מתוך הממשק
1. לך ל**הגדרות** (⚙️)
2. גלול ל**תחזוקה**
3. לחץ **"אפס SW + Cache"**

### איפוס ידני בדפדפן
1. פתח DevTools (F12)
2. לך ל-Application → Service Workers
3. לחץ "Unregister"
4. לך ל-Application → Storage
5. לחץ "Clear site data"
6. רענן (Ctrl+Shift+R)

### פרמטר URL לעקיפת Cache
```
http://localhost:8000?nocache=1
```

---

## 📥 ייבוא שאלות

### ייבוא JSON
1. פתח CMS (יש להזין סיסמה: `skymind`)
2. לשונית "ייבוא/ייצוא"
3. לחץ "ייבא JSON"
4. בחר קובץ JSON

### ייבוא טקסט גולמי
1. פתח CMS
2. לשונית "ייבוא/ייצוא"
3. לחץ "ייבא TXT"
4. בחר קובץ/ים

### פורמט JSON לשאלות
```json
[
  {
    "id": "unique_id",
    "mainTopic": "נושא ראשי",
    "questionText": "מה הדבר?",
    "choices": ["תשובה 1", "תשובה 2", "תשובה 3", "תשובה 4"],
    "correctIndex": 0,
    "explanation": "הסבר אופציונלי"
  }
]
```

---

## ✅ רשימת בדיקה (Self-Test)

- [ ] Hard refresh + app loads without errors
- [ ] No console errors (F12 → Console)
- [ ] Questions load (from data/questions.json or via upload)
- [ ] Smart Tutor starts and shows questions
- [ ] Topic modes work: Normal, Failed, Mastered, Infinite
- [ ] Infinite mode completes when all questions mastered
- [ ] Settings screen accessible and working
- [ ] Dark/Light theme toggle works
- [ ] CMS unlock works (password: skymind)
- [ ] Question CRUD (create/edit/delete) works
- [ ] Topic management works
- [ ] Import/Export works without data loss
- [ ] Service worker update doesn't break app
- [ ] Clear cache tools work

---

## 📝 מה השתנה ב-3.2.0

### תכונות חדשות
- **מצבי תרגול לפי נושא**: רגיל, לא הצלחתי, הצלחתי, אינסופי
- **מצב אינסופי**: תרגל עד שליטה מלאה עם alertness checks
- **פרופילי QSE**: בחר את סגנון הלימוד (מאוזן, חזרות, חולשות, חדש, מבחן)
- **מערכת דרגות**: 10 דרגות בנושא רחפנים (טירון → אגדה)
- **26 הישגים**: כולל הישגי מצב אינסופי וחזרה מנצחת

### שיפורים
- תמיכה משופרת במצב file://
- ממשק טעינת קבצים עם drag & drop
- תצוגת דרגות עם אייקונים
- בחירת פרופיל Smart Tutor מהממשק

### תיקונים
- גרסת Service Worker מעודכנת
- אין כפילויות באתחול
- ניווט חלק בין מסכים

---

## ⚠️ מגבלות ידועות

1. **PDF Import**: לא נתמך ישירות - המר ל-TXT קודם
2. **מסכי מגע קטנים**: חלק מהכפתורים צפופים במסך < 320px
3. **Safari iOS**: PWA עשוי לדרוש רענון אחרי עדכון גרסה

---

## 📞 תמיכה

אם משהו לא עובד:
1. נסה לאפס Cache (הגדרות → תחזוקה)
2. בדוק את הקונסול (F12) לשגיאות
3. נסה במצב Incognito
