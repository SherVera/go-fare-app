# Modelos de base de datos — go-fare-backend

> Referencia generada de las entidades TypeORM en `src/**/entities/*.entity.ts`.
> Convención de nombres de tabla: ver [CLAUDE.md](../../CLAUDE.md) (sección "Nombres de tablas").
> Regenera este doc con el skill `/document-models`.

Convenciones transversales (aplican a casi todas las tablas):

- **`id`** `bigint` `@PrimaryGeneratedColumn` — clave primaria interna; marcada `@Exclude()` + `@ApiHideProperty()`, **nunca** se serializa ni se expone en la API.
- **`uuid`** `uuid` `unique`, `default gen_random_uuid()` — identificador **público** usado en endpoints y respuestas.
- **`createdAt` / `updatedAt`** — `@CreateDateColumn` / `@UpdateDateColumn` (las tablas append-only solo tienen `createdAt`).
- Las FKs (`*_id` `bigint`) están marcadas `@Exclude()`; la relación se expone vía el objeto anidado (`owner`, `user`, …).

---

## Índice de tablas

| Entidad | Tabla | Módulo | Para qué sirve |
|---|---|---|---|
| `User` | `users` | `users/` | Cuenta de usuario (email/OAuth/phone); raíz de identidad y auth |
| `Role` | `roles` | `roles/` | Rol del sistema (RBAC); se asigna en el primer login |
| `Permission` | `permissions` | `permissions/` | Permiso granular (resource + action) ligado a roles |
| `Passenger` | `passengers` | `users/` | Perfil 1:1 de pasajero; arranca `approved`, sin revisión |
| `Driver` | `drivers` | `users/` | Perfil 1:1 de conductor; licencia + flujo de aprobación admin |
| `TransportOwner` | `transport_owners` | `users/` | Perfil 1:1 de dueño de unidades; RIF + aprobación admin |
| `CivilAssociation` | `civil_associations` | `users/` | Perfil 1:1 de representante de asociación civil de transporte |
| `Vehicle` | `vehicles` | `vehicles/` | Unidad de transporte del owner (placa, marca, capacidad) |
| `InviteCode` | `invite_codes` | `invite-codes/` | Código de un solo uso que asocia un conductor a un owner |
| `LegalDocument` | `legal_documents` | `legal-documents/` | Documento legal venezolano (conductor/vehículo); flujo de revisión |
| `Route` | `routes` | `routes/` | Ruta del owner con su tarifa en fares |
| `FareValue` | `fare_values` | `rates/` | Valor de 1 fare en USD (append-only, vigente = más reciente) |
| `BcvRate` | `bcv_rates` | `rates/` | Tasa BCV (Bs por USD) por día (vigente = más reciente) |
| `FareAccount` | `fare_accounts` | `fare/` | Monedero de fares del usuario (balance) |
| `FareTransaction` | `fare_transactions` | `fare/` | Movimiento (credit/debit) sobre un `FareAccount` |
| `CashSession` | `cash_sessions` | `cash-sessions/` | Jornada de caja del conductor (cobros + liquidación al owner) |
| `CashSessionEvent` | `cash_session_events` | `cash-sessions/` | Bitácora append-only de eventos de la jornada |
| `Ride` | `rides` | `rides/` | Cobro de un pasaje vía QR (append-only, con snapshots) |
| `Ticket` | `tickets` | `tickets/` | Pasaje QR (precio, vigencia, estado) |
| `BankAccount` | `bank_accounts` | `banking/` | Cuenta de tesorería (BNC/Mercantil); credenciales cifradas |
| `BankBatch` | `bank_batches` | `banking/` | Cabecera de un lote de pagos (payout) a beneficiarios |
| `BankBatchItem` | `bank_batch_items` | `banking/` | Línea de pago dentro de un lote (beneficiario + monto) |

**Tablas de join** (sin entidad propia, definidas vía `@JoinTable`):

| Tabla | Une | Definida en |
|---|---|---|
| `user_roles` | `users` ↔ `roles` | `User.roles` |
| `role_permissions` | `roles` ↔ `permissions` | `Role.permissions` |

---

## Diagrama de relaciones (FKs)

```
users 1──1 passengers / drivers / transport_owners / civil_associations
users *──* roles            (user_roles)
roles *──* permissions      (role_permissions)
users ◄── reviewed_by_id    (drivers, transport_owners, civil_associations)

vehicles.owner_id          → users.id
routes.owner_id            → users.id
invite_codes.owner_id      → users.id
invite_codes.driver_id     → users.id        (NULL hasta canjearse)
legal_documents.owner_id   → users.id
legal_documents.vehicle_id → vehicles.id      (NULL para docs de persona)
legal_documents.verified_by_id → users.id

fare_accounts.user_id      → users.id
fare_transactions.fare_account_id → fare_accounts.id
fare_transactions.ticket_id → tickets.id       (NULL)
fare_transactions.ride_id  → rides.id           (NULL)
tickets.user_id            → users.id

cash_sessions.{driver_id, owner_id} → users.id
cash_sessions.vehicle_id   → vehicles.id
cash_sessions.route_id     → routes.id
cash_session_events.session_id → cash_sessions.id
rides.session_id           → cash_sessions.id
rides.{driver_id, passenger_id} → users.id
rides.vehicle_id           → vehicles.id
rides.route_id             → routes.id

bank_batches.bank_account_id → bank_accounts.id
bank_batch_items.batch_id  → bank_batches.id
```

---

## users (`users`)

**Módulo:** `users/`
**Para qué sirve:** Cuenta de usuario y raíz de identidad. Soporta tres orígenes (`provider`: `local`, `google`, `phone`). Los roles se cargan vía `user_roles` y se asignan en el primer login, no en el registro.

### Columnas

| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `email` | varchar | unique, nullable | nullable porque Instagram no entrega email |
| `phoneNumber` | varchar | unique, nullable | |
| `phoneVerified` | boolean | default false | gate de `PhoneVerifiedGuard` |
| `nationalId` | varchar | unique, nullable | cédula/RIF |
| `firstName` / `lastName` / `displayName` | varchar | nullable | |
| `provider` | enum | `google` \| `local` \| `phone` | |
| `providerId` | varchar | unique | UID de Firebase / del proveedor |
| `profilePhoto` | varchar | nullable | |
| `accessToken` / `refreshToken` | text | nullable, **`@Exclude()`** | tokens OAuth, nunca se serializan |

### Relaciones
- `roles` *↔* `roles` (ManyToMany vía `user_roles`, `onDelete: CASCADE`)
- `passenger` / `driver` / `transportOwner` / `civilAssociation` (OneToOne con cada perfil)

### Reglas / notas
- OAuth (Google) y phone login crean usuarios **sin rol** → requieren asignación manual.

---

## roles (`roles`) · permissions (`permissions`)

**Módulo:** `roles/` + `permissions/` — **Para qué sirve:** RBAC. `Role` agrupa permisos y se asigna a usuarios; `Permission` describe una acción concreta sobre un recurso.

### roles
| Columna | Tipo | Reglas |
|---|---|---|
| `name` | varchar | unique |
| `description` | varchar | nullable |

- `users` *↔* `users` (ManyToMany, `user_roles`)
- `permissions` *↔* `permissions` (ManyToMany, **owner** de `role_permissions`)
- El `name` debe coincidir con el enum `RegistrationRole` (`passenger`, `driver`, `transport_owner`, `civil_association`) + `admin`.

### permissions
| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `name` | varchar | unique | |
| `description` | varchar | nullable | |
| `resource` | varchar | | ej. `ticket`, `fare`, `user` (`PermissionResource`) |
| `action` | varchar | | ej. `create`, `read`, `update`, `delete`, `manage` (`PermissionAction`) |

- `roles` *↔* `roles` (ManyToMany, `onDelete: CASCADE`)

---

## passengers · drivers · transport_owners · civil_associations

Perfiles **1:1 con `users`** (no entidades-persona independientes). Comparten estructura base: `userId` (unique, FK a `users`, `OneToOne onDelete: CASCADE`), `status` (`ProfileStatus`), y campos de revisión embebidos (`rejectionReason`, `submittedAt`, `reviewedAt`, `reviewedById` → `reviewedBy`). **No existen tablas `*_requests`**: la solicitud/aprobación vive embebida.

`ProfileStatus`: `not_applied` · `pending_review` · `approved` · `rejected` · `suspended`.

### passengers (`passengers`)
Se crea automáticamente para todo `User` en su primer login; arranca en `approved`, sin revisión.
| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `status` | enum `ProfileStatus` | default `approved` | |
| `address` | varchar | nullable | KYC ligero |

### drivers (`drivers`)
Perfil de conductor; requiere revisión admin.
| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `status` | enum `ProfileStatus` | default `not_applied` | |
| `licenseNumber` | varchar | unique, nullable | licencia venezolana |
| `licenseCategory` | varchar | nullable | D o E para transporte público |
| `licenseExpiresAt` | date | nullable | |

### transport_owners (`transport_owners`)
Dueño de unidades (natural o jurídico); requiere aprobación antes de registrar `Vehicle`.
| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `status` | enum `ProfileStatus` | default `not_applied` | |
| `legalName` | varchar | nullable | razón social |
| `rif` | varchar | unique, nullable | identificador fiscal VE |
| `address` | varchar | nullable | |

### civil_associations (`civil_associations`)
Perfil del representante de una asociación civil de transporte (la entidad legal con rutas se modela aparte en Fase 2).
| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `status` | enum `ProfileStatus` | default `not_applied` | |
| `position` | varchar | nullable | cargo (presidente, secretario…) |

---

## vehicles (`vehicles`)

**Módulo:** `vehicles/` — **Para qué sirve:** Unidad de transporte registrada por un owner.

| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `ownerId` | bigint | FK → users.id, **`@Exclude()`** | |
| `plate` | varchar | unique | placa |
| `brand` / `model` | varchar | | |
| `year` | int | | |
| `capacity` | int | | nº de asientos |
| `color` | varchar | nullable | |
| `photoUrl` | varchar | nullable | |
| `status` | enum `VehicleStatus` | default `active` | `active` · `inactive` · `suspended` |
| `routeNumber` | varchar | nullable | concesión INTT (informativo; distinto de `routes`) |

- `owner` → `users` (ManyToOne).

---

## invite_codes (`invite_codes`)

**Módulo:** `invite-codes/` — **Para qué sirve:** Código de un solo uso que el owner emite y el conductor canjea para quedar asociado a la flota (acceso a todos los vehículos del owner).

| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `code` | varchar(8) | unique | código corto de un solo uso |
| `ownerId` | bigint | FK → users.id, **`@Exclude()`** | emisor |
| `driverId` | bigint | nullable, FK → users.id, **`@Exclude()`** | NULL hasta canjearse |
| `issuedAt` | timestamp | default now | emisión |
| `usedAt` | timestamp | nullable | canje = fecha de asociación |
| `revokedAt` | timestamp | nullable | baja de la asociación |

### Reglas / notas
- **Estado implícito por fechas** (sin enum): `issued` (sin `usedAt`) → `used`/activo (`usedAt` sin `revokedAt`) → `revoked` (histórico).
- **Única** tabla de asociación conductor↔owner. Invariante: un conductor = una asociación activa, garantizada por índice parcial único sobre `driver_id WHERE used_at IS NOT NULL AND revoked_at IS NULL`.

---

## legal_documents (`legal_documents`)

**Módulo:** `legal-documents/` — **Para qué sirve:** Documento legal venezolano de un conductor o vehículo; flujo `pending_review → verified/rejected` (o `expired`).

| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `ownerId` | bigint | FK → users.id, **`@Exclude()`** | dueño del documento |
| `vehicleId` | bigint | nullable, FK → vehicles.id, **`@Exclude()`** | solo docs de vehículo |
| `type` | enum `DocumentType` | | ver lista abajo |
| `documentNumber` | varchar | nullable | |
| `fileUrl` | varchar | | URL permanente (vía `/storage/signed-url`) |
| `issuedAt` / `expiresAt` | date | nullable | |
| `status` | enum `DocumentStatus` | default `pending_review` | `pending_review` · `verified` · `rejected` · `expired` |
| `verifiedById` | bigint | nullable, **`@Exclude()`** | admin revisor → `verifiedBy` |
| `rejectionReason` | text | nullable | |

`DocumentType` — **conductor:** `cedula_identidad`, `licencia_conducir`, `certificado_medico`, `antecedentes_penales`, `seguro_vida`. **vehículo/dueño:** `titulo_propiedad`, `seguro_soat`, `seguro_responsabilidad_civil`, `revision_tecnica_intt`, `concesion_ruta`, `patente_municipal`.

---

## routes (`routes`)

**Módulo:** `routes/` — **Para qué sirve:** Ruta de transporte con su tarifa en fares, definida por el owner. Se asigna a una jornada al abrirla; la jornada toma `fareCost` como snapshot. (Distinta de `Vehicle.routeNumber`, que es la concesión informativa del INTT.)

| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `ownerId` | bigint | FK → users.id, **`@Exclude()`** | |
| `name` | varchar | | |
| `code` | varchar | nullable | código corto |
| `fareCost` | int | | cuántos fares cuesta el pasaje |
| `isActive` | boolean | default true | |

---

## fare_values (`fare_values`) · bcv_rates (`bcv_rates`)

**Módulo:** `rates/` — Tablas **append-only** de configuración de tasas; el registro vigente es el más reciente. Solo tienen `createdAt`.

### fare_values
Valor de 1 fare en USD.
| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `usdValue` | decimal(10,4) | | valor de 1 fare en USD (ej. 0.2500) |
| `createdById` | bigint | nullable, **`@Exclude()`** | admin (NULL si viene de seed) |

### bcv_rates
Tasa del dólar BCV por día. Carga manual (endpoint admin); cron/scraping en fase posterior.
| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `rate` | decimal(14,4) | | bolívares por 1 USD |
| `rateDate` | date | unique | una fila por día (YYYY-MM-DD) |
| `createdById` | bigint | nullable, **`@Exclude()`** | admin (NULL si viene de seed) |

---

## fare_accounts (`fare_accounts`) · fare_transactions (`fare_transactions`)

**Módulo:** `fare/` — **Para qué sirve:** Monedero de fares del usuario y su libro de movimientos.

### fare_accounts
| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `userId` | bigint | FK → users.id, **`@Exclude()`** | |
| `balance` | decimal(10,2) | default 0 | saldo en fares |
| `isActive` | boolean | default true | |

- `transactions` → `fare_transactions` (OneToMany).

### fare_transactions
| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `fareAccountId` | bigint | FK → fare_accounts.id, **`@Exclude()`** | |
| `amount` | decimal(10,2) | | |
| `type` | enum | `credit` \| `debit` | |
| `transactionType` | enum | categoría | `payment` · `refund` · `transfer` · `ticket_purchase` · `top_up` · `ride_payment` · `session_settlement` |
| `description` | varchar | nullable | |
| `ticketId` | bigint | nullable, **`@Exclude()`** | si proviene de un ticket |
| `rideId` | bigint | nullable, **`@Exclude()`** | para movimientos `ride_payment` |

- `fareAccount` (ManyToOne), `ticket` (nullable), `ride` (nullable).

---

## cash_sessions (`cash_sessions`) · cash_session_events (`cash_session_events`)

**Módulo:** `cash-sessions/` — **Para qué sirve:** Jornada de caja del conductor y su bitácora de auditoría.

### cash_sessions
Abre en un vehículo + ruta, acumula cobros (`totalFares`/`ridesCount`) y al cerrarse liquida lo recaudado al owner. `fareCost`, `routeId` y `ownerId` se fijan como **snapshot** al abrir.
| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `driverId` / `vehicleId` / `routeId` / `ownerId` | bigint | FK, **`@Exclude()`** | snapshot al abrir |
| `fareCost` | int | | snapshot de la tarifa de la ruta |
| `status` | enum `CashSessionStatus` | default `open` | `open` · `paused` · `closed` |
| `totalFares` | decimal(12,2) | default 0 | fares acumulados |
| `ridesCount` | int | default 0 | |
| `openedAt` | timestamp | default now | |
| `closedAt` | timestamp | nullable | |
| `settledAt` | timestamp | nullable | acreditación al owner |

- **Índice parcial único** `uq_cash_sessions_active_driver` sobre `driver_id WHERE status <> 'closed'`: un conductor solo puede tener una jornada no cerrada.

### cash_session_events
Bitácora **append-only** (solo `createdAt`): apertura, pausas, reanudaciones y cierre. Sustenta la auditoría owner ↔ conductor.
| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `sessionId` | bigint | FK → cash_sessions.id, **`@Exclude()`** | |
| `type` | enum `CashSessionEventType` | | `open` · `pause` · `resume` · `close` |
| `byUserId` | bigint | nullable, **`@Exclude()`** | quién originó el evento |

---

## rides (`rides`)

**Módulo:** `rides/` — **Para qué sirve:** Cobro de un pasaje vía QR. Registro **inmutable** (append-only, solo `createdAt`) con snapshots de tarifa y tasas → auditoría reproducible aunque luego cambien el valor del fare, la tasa BCV o la ruta.

| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `sessionId` | bigint | FK → cash_sessions.id, **`@Exclude()`** | |
| `vehicleId` / `routeId` / `driverId` / `passengerId` | bigint | FK, **`@Exclude()`** | |
| `fareCost` | int | | fares cobrados (snapshot) |
| `fareUsdValue` | decimal(10,4) | | valor del fare en USD al cobro (snapshot) |
| `bcvRate` | decimal(14,4) | | tasa BCV al cobro (snapshot) |
| `bsAmount` | decimal(14,2) | | equivalente en Bs (snapshot) |
| `status` | enum `RideStatus` | default `completed` | hoy solo `completed` |

---

## tickets (`tickets`)

**Módulo:** `tickets/` — **Para qué sirve:** Pasaje QR con precio, vigencia y estado.

| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `userId` | bigint | FK → users.id, **`@Exclude()`** | |
| `qrCode` | varchar | unique | |
| `price` | decimal(10,2) | | |
| `status` | enum | default `pending` | `pending` · `active` · `used` · `expired` · `cancelled` |
| `route` / `origin` / `destination` | varchar | nullable | |
| `validFrom` / `validUntil` | timestamp | nullable | ventana de validez |
| `usedAt` | timestamp | nullable | |

- `user` → `users` (ManyToOne).

---

## bank_accounts (`bank_accounts`)

**Módulo:** `banking/` — **Para qué sirve:** Cuenta de tesorería de goFare (BNC/Mercantil) para consultar saldo, verificar pagos y emitir lotes. Las credenciales viven **cifradas** (AES-256-GCM) y nunca se serializan ni se loguean.

| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `provider` | enum `BankProviderName` | | `bnc` · `mercantil` |
| `alias` | varchar(120) | | etiqueta legible |
| `accountNumber` | varchar(30) | | se enmascara al exponer |
| `rif` | varchar(20) | | titular |
| `environment` | enum `BankEnvironment` | default `sandbox` | `sandbox` · `production` |
| `credentialsCipher` | text | **`@Exclude()`** | credenciales cifradas (AES-256-GCM) |
| `isActive` | boolean | default true | |
| `createdById` | bigint | nullable, **`@Exclude()`** | |

---

## bank_batches (`bank_batches`) · bank_batch_items (`bank_batch_items`)

**Módulo:** `banking/` — **Para qué sirve:** Lote de pagos (payout) a beneficiarios (liquidación a owners/conductores) y sus líneas.

### bank_batches
Cabecera que agrupa N líneas y guarda el ciclo `pending → submitted → processing → completed/partial/failed`.
| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `bankAccountId` | bigint | FK → bank_accounts.id, **`@Exclude()`** | |
| `provider` | enum `BankProviderName` | | |
| `status` | enum `BankBatchStatus` | default `pending` | `pending` · `submitted` · `processing` · `completed` · `partial` · `failed` |
| `currency` | varchar(3) | default `VES` | |
| `totalAmount` | decimal(14,2) | default 0 | |
| `itemCount` | int | default 0 | |
| `providerBatchRef` | varchar(64) | nullable | id del lote en el banco |
| `submittedAt` | timestamp | nullable | |
| `createdById` | bigint | nullable, **`@Exclude()`** | |

- `bankAccount` (ManyToOne), `items` → `bank_batch_items` (OneToMany).

### bank_batch_items
Una línea de pago: un beneficiario, un monto, un estado.
| Columna | Tipo | Reglas | Notas |
|---|---|---|---|
| `batchId` | bigint | FK → bank_batches.id, **`@Exclude()`** | |
| `beneficiaryName` | varchar(140) | | |
| `beneficiaryDocument` | varchar(20) | | |
| `beneficiaryAccount` | varchar(30) | | cuenta destino o teléfono (pago móvil) |
| `bankCode` | varchar(4) | nullable | banco destino |
| `amount` | decimal(14,2) | | |
| `concept` | varchar(120) | nullable | |
| `status` | enum `BankBatchItemStatus` | default `pending` | `pending` · `paid` · `rejected` |
| `providerItemRef` | varchar(64) | nullable | id de la línea en el banco |
| `rejectionReason` | varchar(200) | nullable | |
