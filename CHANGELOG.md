# 📝 Development & Change Log (บันทึกประวัติการแก้ไขระบบ)

> เอกสารนี้บันทึกประวัติการแก้ไข บั๊กฟิกซ์ และการเพิ่มฟีเจอร์ทั้งหมดของโปรเจกต์ AI Finance Tracker (AIFT) อย่างเป็นระบบ

---

## 📌 สรุปรูปแบบการบันทึก
- **[Feature]**: เพิ่มฟังก์ชันหรือฟีเจอร์ใหม่
- **[Fix]**: แก้ไขข้อผิดพลาดหรือบั๊ก
- **[Config / Infra]**: ปรับแต่งการตั้งค่า Environment, Docker หรือ Database
- **[Docs]**: จัดทำหรืออัปเดตเอกสาร

---

## 🕒 บันทึกรายการเปลี่ยนแปลง (Change History)

### 📅 2026-09-23 14:19:00 (Local Time)
**ประเภท:** `[Enhancement]` `[Frontend / UI]`  
**หัวข้อ:** ปรับปรุง UI หน้าต่าง Model Limits Console ให้เป็นสไตล์ Minimal สะอาดตา ลดความแออัดของข้อมูล  
**ความต้องการ:**
- ผู้ใช้แจ้งว่าหน้าต่าง Limit โมเดล AI ดูรกและแน่นเกินไป ต้องการให้ดูง่าย สบายตา และจัดระเบียบข้อมูลใหม่

**สิ่งที่แก้ไข:**
1. **Compact Quota Ribbon:** รวมการ์ดโควตาสี่เหลี่ยมขนาดใหญ่ 4 ใบ ให้เป็นแถบสรุปข้อมูลแถวเดียว (RPM 15, RPD 1,500, TPM 1M, Context 1M In/65K Out) ประหยัดพื้นที่ในแนวตั้ง
2. **Clean Row & Expandable List:** ออกแบบรายการโมเดล Waterfall ใหม่เป็นแถวกะทัดรัด แยกสีโมเดลหลักอย่างชัดเจน แสดงเฉพาะสาระสำคัญ และสามารถคลิกที่แถวเพื่อกางดูรายละเอียด (Collapsible) เพิ่มเติมได้ตามต้องการ
3. **Refined Header & Controls:** ปรับป้ายกำกับด้านบนให้เรียบหรู ลดความซ้ำซ้อนของคำอธิบาย เพิ่มจุดสถานะ API เชื่อมต่อแบบ Minimal และเปลี่ยนตัวสลับแท็บเป็น Segmented Switch ที่ทันสมัย
4. **Spacing & Contrast:** จัดระเบียบช่องไฟ (Whitespace) และปรับขนาดฟอนต์ให้อ่านง่าย ไม่รบกวนสายตา

**ไฟล์ที่แก้ไข:**
- `aift-frontend/src/app/components/admin-model-limits/admin-model-limits.component.ts`
- `aift-frontend/src/app/components/admin-model-limits/admin-model-limits.component.html`
- `aift-frontend/src/app/components/admin-model-limits/admin-model-limits.component.scss`
- `CHANGELOG.md`

---

### 📅 2026-09-23 14:10:00 (Local Time)
**ประเภท:** `[Feature]` `[Role / Admin / AI Monitoring]`  
**หัวข้อ:** เพิ่มสิทธิ์ Admin ให้บัญชี Aingkharat และสร้างหน้าต่างตรวจสอบขีดจำกัดโมเดล AI (Model Limits & Waterfall Console)  
**ความต้องการ:**
- กำหนดให้บัญชีผู้ใช้ `Aingkharat` เป็น Role `admin`
- สร้างหน้าต่าง/Console สำหรับ Admin เพื่อดูขีดจำกัดโมเดล AI (Google Gemini Quotas, Token Limits, Waterfall Priority 4 ลำดับ, สถานะ API Key) พร้อมปุ่มทดสอบ Ping เช็คความเร็วของโมเดล
- บล็อกผู้ใช้งานทั่วไปไม่ให้เข้าถึงข้อมูลและ Endpoint ของผู้ดูแลระบบ (403 Forbidden)

**สิ่งที่แก้ไข:**
1. **Database & Entity Migration:**
   - เพิ่มฟิลด์ `role: string` (default `'user'`) ลงใน `User` entity
   - อัปเดตข้อมูลในตาราง PostgreSQL: `UPDATE users SET role = 'admin' WHERE username = 'Aingkharat';`
2. **Backend Admin Module & Security Guard:**
   - สร้าง `AdminGuard` ตรวจสอบ JWT Payload หาก `role !== 'admin'` จะปฏิเสธคำขอด้วย `403 Forbidden` ทันที
   - สร้าง `AdminService` และ `AdminController`:
     - `GET /admin/models`: ดึงข้อมูลขีดจำกัดของระบบ (15 RPM, 1,500 RPD, 1,000,000 TPM), ลำดับโมเดล Waterfall 4 ตัว (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, `gemini-3.1-flash-lite`, `gemini-2.5-flash-lite`), ขีดจำกัด Input (1M) / Output (65K) และดึงรายชื่อโมเดลสดจาก Google API
     - `POST /admin/ping`: ทดสอบ Ping ยิงทดสอบโมเดลและวัดค่า Latency (ms) แบบเรียลไทม์
   - ลงทะเบียน `AdminModule` ใน `AppModule`
3. **Frontend AuthService & Admin Service:**
   - เพิ่มฟิลด์ `role?: string` ใน `User` interface
   - เพิ่ม Signal `isAdmin = computed(() => this.currentUser()?.role === 'admin')`
   - สร้าง `AdminService` สำหรับดึงข้อมูลโมเดลและยิงทดสอบ Ping
4. **Admin Model Limits UI Component:**
   - สร้าง `AdminModelLimitsComponent` (Modal Dialog):
     - การ์ดสถิติโควตา: สถานะ API Key, RPM (15 ครั้ง/นาที), RPD (1,500 ครั้ง/วัน), TPM (1M โทเค็น/นาที)
     - แท็บระบบ Waterfall: แสดงโมเดลทั้ง 4 ลำดับ พร้อมคำอธิบาย, ขีดจำกัด Input/Output tokens, และปุ่ม `⚡ ทดสอบ Ping` แสดงผลความหน่วงแบบสด
     - แท็บโมเดลทั้งหมดจาก Google: ตารางแสดงรายชื่อโมเดลที่ Google รองรับ
   - อัปเดต Top Navbar (`app.ts` & `app.scss`):
     - แสดงป้าย `ADMIN` สีเขียวข้างชื่อผู้ใช้
     - แสดงปุ่ม `👑 สถานะโมเดล AI` เฉพาะผู้ใช้ที่มีสิทธิ์ Admin เท่านั้น เมื่อคลิกจะเปิด Modal ทันที

**ไฟล์ที่แก้ไข:**
- `aift-backend/src/auth/entities/user.entity.ts`
- `aift-backend/src/auth/auth.service.ts`
- `aift-backend/src/admin/admin-auth.guard.ts`
- `aift-backend/src/admin/admin.service.ts`
- `aift-backend/src/admin/admin.controller.ts`
- `aift-backend/src/admin/admin.module.ts`
- `aift-backend/src/app.module.ts`
- `aift-frontend/src/app/services/auth.service.ts`
- `aift-frontend/src/app/services/admin.service.ts`
- `aift-frontend/src/app/components/admin-model-limits/*`
- `aift-frontend/src/app/app.ts`
- `aift-frontend/src/app/app.scss`
- `aift-frontend/angular.json`
- `CHANGELOG.md`

---

### 📅 2026-09-23 13:58:00 (Local Time)
**ประเภท:** `[Fix]` `[Frontend / UI]`  
**หัวข้อ:** แก้ไขกล่องแจ้งเตือน Error ในหน้า Login / Register ไม่แสดงผลบนจอ (Zoneless Angular)  
**ปัญหาที่พบ:**
- เมื่อสมัครสมาชิกด้วย Username ซ้ำ (409 Conflict) หรือกรอกรหัสผ่านผิด หน้าเว็บไม่แสดงกล่องแจ้งเตือนสีแดง (Alert Box) โดยค้างเงียบ
- สาเหตุมาจาก Angular 21 ทำงานในโหมด Zoneless เมื่อเกิด Error ใน RxJS callback การเปลี่ยนค่าตัวแปรคลาสธรรมดาจะไม่กระตุ้นให้ Angular วาดหน้าจอใหม่

**สิ่งที่แก้ไข:**
1. **Migration to Signals:** เปลี่ยน State ใน `AuthComponent` มาใช้ Angular Signals (`errorMessage`, `isLoading`, `isRegisterMode`)
2. **Explicit Change Detection:** ฉีด `ChangeDetectorRef` และสั่ง `cdr.detectChanges()` ทันทีเมื่อเกิด Error
3. **Control Flow Syntax:** ปรับ Template ใน `auth.component.html` มาใช้ `@if (errorMessage())` แสดงกล่องข้อความเตือนสีแดงชัดเจน

**ไฟล์ที่แก้ไข:**
- `aift-frontend/src/app/components/auth/auth.component.ts`
- `aift-frontend/src/app/components/auth/auth.component.html`

---
**ประเภท:** `[Fix]` `[Backend / Frontend]`  
**หัวข้อ:** แก้ไขปัญหาบันทึกรายรับไม่ได้ (AI Could Not Understand & Error Handling)  
**ปัญหาที่พบ:**
- ผู้ใช้พิมพ์บันทึกรายรับสั้นๆ เช่น `"500 บาท"`, `"1000"`, หรือตัวเลขล้วน แล้วระบบแจ้งเตือนว่า AI อ่านไม่ออก และมี Error `500 Internal Server Error` หลุดออกมาใน Log
- ช่องกรอกรายรับใน Frontend ไม่มีการแปลงตัวเลขกรณีเผลอพิมพ์ภาษาไทย (`ถจจ` -> `500`)

**สิ่งที่แก้ไข:**
1. **AI Prompt Tuning:** ปรับ Prompt ใน `extractIncomeData` ให้เข้าใจว่าข้อความในช่องนี้คือรายรับเสมอ หากมีแต่ตัวเลขให้ดึงเป็นยอดเงินและตั้งชื่อที่มาเป็น `"รายรับทั่วไป"` อัตโนมัติ
2. **Smart Fallback (Regex Parser):** เพิ่มระบบ Regex สกัดตัวเลขเงินอัตโนมัติใน `AiService` หาก AI เกิดขัดข้องหรือตอบกลับไม่ทัน ระบบจะดึงยอดเงินและข้อความที่พิมพ์มาบันทึกให้ทันที
3. **Controller Error Handling:** เพิ่มบล็อก `try/catch` ใน `IncomeController.processChat` ให้ส่ง Error `400 BadRequest` พร้อมโค้ดที่ถูกต้อง
4. **Thai Keyboard Fix:** เพิ่มฟังก์ชัน `this.fixThaiKeyboard()` ในฟังก์ชัน `onAddIncome()` ของ Frontend

**ไฟล์ที่แก้ไข:**
- `aift-backend/src/ai/ai.service.ts`
- `aift-backend/src/income/income.controller.ts`
- `aift-frontend/src/app/components/chat-input/chat-input.component.ts`

---

### 📅 2026-09-23 13:40:00 (Local Time)
**ประเภท:** `[Feature]` `[Backend / Frontend / Auth]`  
**หัวข้อ:** พัฒนาระบบ Login / Register และแยกข้อมูลราย Account (100% Data Isolation)  
**ความต้องการ:**
- รองรับการสมัครและเข้าสู่ระบบด้วย Username & Password แบบรวดเร็ว
- แยกข้อมูลรายจ่าย รายรับ งบประมาณ และสรุป AI ของแต่ละบัญชีออกจากกันอย่างเด็ดขาด
- จำสถานะการล็อกอินผ่าน LocalStorage (Persistent Login)

**สิ่งที่แก้ไข:**
1. **Backend Auth Module:**
   - ติดตั้ง `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`
   - สร้าง `User` entity (`id`, `username`, `password`, `displayName`)
   - สร้าง `AuthService`, `AuthController`, `JwtStrategy`, `JwtAuthGuard`, และ `@CurrentUser()` decorator
2. **Database Scoping:**
   - เพิ่ม `userId` ใน `Expense`, `Income`, `Budget`, และ `AiSummaryCache`
   - ปรับ Unique constraint ของ Budget เป็น `[category, userId]`
   - Scope ทุกการค้นหา สร้าง แก้ไข ลบ ใน Controller และ Service ด้วย `userId`
3. **Frontend Auth System:**
   - สร้าง `AuthService` จัดการ State ด้วย Signals (`currentUser`, `isLoggedIn`)
   - สร้าง `authInterceptor` แนบ Bearer Token ทุก Request อัตโนมัติ
   - สร้าง `authGuard` และ `guestGuard` ป้องกันหน้า Dashboard และ Budgets
   - สร้าง `AuthComponent` (หน้า Login/Register ดีไซน์ Card สวยงาม สลับแท็บได้)
   - อัปเดต Top Navbar แสดง Badge ชื่อผู้ใช้และปุ่ม Logout

**ไฟล์ที่เกี่ยวข้อง:**
- `aift-backend/src/auth/*`
- `aift-backend/src/app.module.ts`
- `aift-backend/src/expenses/*`
- `aift-backend/src/income/*`
- `aift-backend/src/budgets/*`
- `aift-frontend/src/app/services/auth.service.ts`
- `aift-frontend/src/app/interceptors/auth.interceptor.ts`
- `aift-frontend/src/app/guards/auth.guard.ts`
- `aift-frontend/src/app/components/auth/*`
- `aift-frontend/src/app/app.ts` & `app.scss`
- `aift-frontend/src/app/app.routes.ts`
- `aift-frontend/src/app/app.config.ts`

---

### 📅 2026-09-23 11:55:00 (Local Time)
**ประเภท:** `[Fix]` `[Config / Infra / DB]`  
**หัวข้อ:** แก้ไขปัญหาการเชื่อมต่อ Database ใน Docker (`ECONNREFUSED`) และรองรับ Dual Database  
**ปัญหาที่พบ:**
- Backend ใน Docker ไม่สามารถเชื่อมต่อ PostgreSQL ได้ (`connect ECONNREFUSED 127.0.0.1:5432`) เนื่องจากไฟล์ `.env` ชี้ไปที่ `localhost`
- โค้ดใน `app.module.ts` มีการฮาร์ดโค้ด SQLite ไว้ และ Dockerfile ขาด C/C++ compiler สำหรับคอมไพล์ `better-sqlite3` บน Alpine Linux

**สิ่งที่แก้ไข:**
1. **Dynamic Database Switch:** ปรับ `app.module.ts` ให้เลือก Engine ตามตัวแปร `DB_TYPE`:
   - รันใน Docker หรือ `DB_TYPE=postgres` -> ต่อ **PostgreSQL**
   - รัน Local ทั่วไป (`npm run start:dev`) -> สลับไปใช้ **SQLite** (`data/aift.sqlite`) อัตโนมัติ
2. **Docker Compose:** กำหนด `DB_HOST=postgres` และ `DB_TYPE=postgres` ใน `docker-compose.yml`
3. **Dockerfile Alpine Build:** ติดตั้ง `python3 make g++` เพื่อคอมไพล์ native dependencies
4. **Documentation:** จัดทำเอกสารส่งมอบงานฉบับสมบูรณ์ [HANDOFF.md](file:///c:/Project/AIFT/HANDOFF.md)

**ไฟล์ที่แก้ไข:**
- `aift-backend/src/app.module.ts`
- `aift-backend/Docker/docker-compose.yml`
- `aift-backend/Docker/Dockerfile`
- `HANDOFF.md`
