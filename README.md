# Pickleball Management System

## Phase 1: Architecture and planning

This repository is the backend foundation for a production-grade Pickleball Management System. The project intentionally keeps the initial scope small and realistic: a modular Fastify API backed by PostgreSQL + Prisma, with a future React web app and Capacitor mobile wrapper layered on top.

## 1. Architecture diagram

```text
React + TypeScript + Capacitor
        │
        │ HTTPS / REST API
        ▼
Node.js + TypeScript + Fastify
        │
        ▼
Prisma ORM
        │
        ▼
PostgreSQL
```

### Architectural principles
- The database is the source of truth.
- The backend owns all business rules and financial calculations.
- The frontend is presentation and interaction only.
- Cashier-facing workflows prioritize speed and reliability.
- Admin features are permission-gated on the backend.
- All money uses DECIMAL / NUMERIC at the database layer and is validated server-side.

## 2. ERD

```text
ROLES
  │
  └── USERS
        │
        ├── TRANSACTIONS
        │     │
        │     ├── TRANSACTION_PLAYERS
        │     │     ├── PLAYERS
        │     │     └── RATES
        │     │
        │     ├── PAYMENTS
        │     │
        │     └── COURTS
        │
        ├── EXPENSES
        │     └── EXPENSE_CATEGORIES
        │
        └── AUDIT_LOGS
```

### Core business rules
- `transactions` is one cashier checkout lifecycle.
- `transaction_players` links a transaction to selected players and rate choices.
- `payments` stores the final payment method and payment metadata.
- Completed transactions are never hard deleted; they are cancelled when reversed.
- Expense categories are reference data for admin expense tracking.
- Audit logs capture important admin and cashier actions.

## 3. Prisma schema proposal

```prisma
model Role {
  id        String   @id @default(uuid())
  name      RoleName @unique
  users     User[]
  createdAt DateTime @default(now())
}

model User {
  id         String   @id @default(uuid())
  email      String   @unique
  password   String
  firstName  String
  lastName   String
  role       Role     @relation(fields: [roleId], references: [id])
  roleId     String
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  transactions Transaction[]
  expenses     Expense[]
  auditLogs    AuditLog[]
}

model Player {
  id          String              @id @default(uuid())
  fullName    String
  phone       String?
  isActive    Boolean             @default(true)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  transactionPlayers TransactionPlayer[]
}

model Court {
  id          String        @id @default(uuid())
  name        String
  code        String        @unique
  isActive    Boolean       @default(true)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  transactions Transaction[]
}

model Rate {
  id          String              @id @default(uuid())
  name        String
  code        String              @unique
  amount      Decimal             @db.Decimal(10, 2)
  isActive    Boolean             @default(true)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  transactionPlayers TransactionPlayer[]
}

model Transaction {
  id              String              @id @default(uuid())
  transactionCode String             @unique
  cashier         User                @relation(fields: [cashierId], references: [id])
  cashierId       String
  court           Court               @relation(fields: [courtId], references: [id])
  courtId         String
  transactionDate DateTime
  startTime       DateTime
  endTime         DateTime
  total           Decimal             @db.Decimal(10, 2)
  paymentMethod   PaymentMethod
  status          TransactionStatus   @default(COMPLETED)
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  players         TransactionPlayer[]
  payments        Payment[]
  auditLogs       AuditLog[]
}

model TransactionPlayer {
  id            String      @id @default(uuid())
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  transactionId String
  player        Player      @relation(fields: [playerId], references: [id])
  playerId      String
  rate          Rate        @relation(fields: [rateId], references: [id])
  rateId        String
  amount        Decimal     @db.Decimal(10, 2)
  createdAt     DateTime    @default(now())

  @@unique([transactionId, playerId])
}

model Payment {
  id            String        @id @default(uuid())
  transaction   Transaction   @relation(fields: [transactionId], references: [id])
  transactionId String
  type          PaymentMethod
  amount        Decimal       @db.Decimal(10, 2)
  paidAt        DateTime      @default(now())
  reference     String?
}

model ExpenseCategory {
  id        String    @id @default(uuid())
  name      String    @unique
  isActive  Boolean   @default(true)
  expenses  Expense[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Expense {
  id            String          @id @default(uuid())
  category      ExpenseCategory @relation(fields: [categoryId], references: [id])
  categoryId    String
  description   String
  amount        Decimal         @db.Decimal(10, 2)
  expenseDate   DateTime
  paymentMethod PaymentMethod
  notes         String?
  createdBy     User            @relation(fields: [createdById], references: [id])
  createdById   String
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
}

model AuditLog {
  id          String   @id @default(uuid())
  user        User?    @relation(fields: [userId], references: [id])
  userId      String?
  action      String
  entityType  String
  entityId    String?
  description String
  createdAt   DateTime @default(now())
}

enum RoleName {
  ADMIN
  CASHIER
}

enum PaymentMethod {
  CASH
  GCASH
  CARD
  BANK_TRANSFER
}

enum TransactionStatus {
  COMPLETED
  CANCELLED
}
```

## 4. API endpoint specification

### Authentication
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Transactions
- `GET /api/transactions`
- `GET /api/transactions/:id`
- `POST /api/transactions`
- `POST /api/transactions/:id/cancel`

### Players
- `GET /api/players`
- `GET /api/players/:id`
- `POST /api/players`
- `PUT /api/players/:id`

### Courts
- `GET /api/courts`
- `POST /api/courts`
- `PUT /api/courts/:id`

### Rates
- `GET /api/rates`
- `POST /api/rates`
- `PUT /api/rates/:id`

### Users
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`

### Expenses
- `GET /api/expenses`
- `POST /api/expenses`
- `PUT /api/expenses/:id`

### Expense Categories
- `GET /api/expense-categories`
- `POST /api/expense-categories`
- `PUT /api/expense-categories/:id`

### Analytics
- `GET /api/analytics/overview`
- `GET /api/analytics/revenue`
- `GET /api/analytics/players`
- `GET /api/analytics/payment-methods`
- `GET /api/analytics/courts`
- `GET /api/analytics/cashiers`

### Response contract
```json
{
  "success": true,
  "data": {}
}
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid transaction data"
  }
}
```

## 5. Frontend folder structure

```text
src/
├── app/
├── routes/
├── layouts/
├── features/
│   ├── auth/
│   ├── cashier/
│   ├── transactions/
│   ├── players/
│   ├── management/
│   ├── analytics/
│   └── expenses/
├── components/
├── hooks/
├── api/
├── schemas/
├── types/
├── utils/
└── styles/
```

## 6. Backend folder structure

```text
src/
├── app.ts
├── server.ts
├── config/
│   └── env.ts
├── plugins/
│   ├── logger.ts
│   ├── auth.ts
│   └── security.ts
├── middleware/
│   ├── auth.ts
│   ├── authorization.ts
│   └── error-handler.ts
├── modules/
│   ├── auth/
│   ├── transactions/
│   ├── players/
│   ├── courts/
│   ├── rates/
│   ├── users/
│   ├── expenses/
│   └── analytics/
├── lib/
│   ├── errors.ts
│   ├── api.ts
│   └── money.ts
├── types/
└── utils/
```

## 7. Authentication strategy

- Use secure password hashing with bcrypt or Argon2id.
- Use a signed JWT for session identity.
- Store only a hash; never store plaintext PINs or passwords.
- Use backend-only authorization checks for every protected route.
- Use role guard middleware: `requireAuth`, `requireRole('ADMIN')`, `requireRole('CASHIER')`.
- `GET /api/auth/me` returns the current authenticated identity.
- Logout is a server-side token invalidation pattern or a short-lived token strategy.

## 8. Authorization matrix

| Route group | Admin | Cashier |
| --- | --- | --- |
| `/api/auth/login` | Yes | Yes |
| `/api/auth/me` | Yes | Yes |
| `/api/transactions` | Yes | Yes |
| `/api/transactions/:id` | Yes | Own or assigned transaction scope if needed |
| `POST /api/transactions` | Yes | Yes |
| `POST /api/transactions/:id/cancel` | Yes | Usually no; restricted by business rule |
| `/api/players` | Yes | Yes |
| `/api/courts` | Yes | No |
| `/api/rates` | Yes | No |
| `/api/users` | Yes | No |
| `/api/expenses` | Yes | No |
| `/api/analytics/*` | Yes | No |

The rule is explicit: cashier endpoints focus on transaction creation; admin is the only role allowed access to financial analytics, pricing, users, and expense management.

## 9. Transaction lifecycle

```text
Cashier opens Open Play
  ↓
Select date
  ↓
Select time slot
  ↓
Select court
  ↓
Add players
  ↓
Choose rates
  ↓
Backend calculates authoritative total
  ↓
Select payment method
  ↓
Create transaction atomically
  ↓
Persist players, payment, audit log
  ↓
Return success response
```

### Atomicity requirement
`POST /api/transactions` runs in one DB transaction:
1. Authenticate cashier
2. Authorize cashier
3. Validate request
4. Validate court
5. Validate players
6. Validate rates
7. Calculate authoritative total
8. Create transaction
9. Create transaction_players rows
10. Create payment row
11. Write audit log
12. Commit

If any step fails, roll back the entire transaction.

## 10. Development plan

### Phase 1 - Architecture and planning (complete)
- System architecture
- ERD
- Database design
- Folder structure
- API design
- Authentication design
- Role permissions

### Phase 2 - Project foundation
- Install Fastify, Prisma, PostgreSQL, TypeScript, ESLint, Prettier 
- Verify build and server startup

### Phase 3 - Database / Prisma
- Prisma schema
- migrations
- seed data for roles, courts, rates, categories
- indexes and constraints

### Phase 4 - Authentication
- login, logout, current user, role guards
- admin/cashier separation

### Phase 5 - Cashier transaction flow
- open play flow
- court, slot, players, rate selection, payment, total validation

### Phase 6 - Admin transactions
- transaction list, search, filtering, details

### Phase 7 - Management
- users, courts, rates

### Phase 8 - Expenses
- categories, create/update history, filtering

### Phase 9 - Analytics
- revenue, player counts, payment methods, trend reporting

### Phase 10 - Testing and security review
- backend unit tests, role checks, transaction atomicity

### Phase 11 - Capacitor mobile validation
- Android/iOS check, touch flows, offline behavior

## Important implementation decisions

### Business rule: money is authoritative on the backend
The frontend may send player IDs and rate IDs, but it must never send a trusted total. The backend fetches rate records and calculates the total using server-side logic. This eliminates floating-point drift and keeps financial integrity intact.

### Business rule: avoid partial transaction writes
All transaction writes must be inside a single database transaction. This prevents orphaned transaction_players or payment rows if a later step fails.

### Business rule: idempotency for mobile and flaky networks
Cashier transactions should be protected by an Idempotency-Key header so duplicate requests do not create multiple transactions on app retry or network interruption.

### Business rule: authorization is server-enforced
Admin-only endpoints are guarded on the backend and must not rely on the frontend hiding navigation. Authorization is a security boundary, not a UI concern.

## Recommended next implementation step
The next stage is project foundation: add environment validation, structured logging, API response helpers, and the initial Fastify app scaffolding for auth and health routes. After that, the database layer and Prisma schema should be implemented and migrated.
