# Cucu Connect REST API

Base URL: `http://localhost:3000`. All responses are JSON. Authenticated routes accept
`Authorization: Bearer <token>`.

## Health
- `GET /api/health` – service status
- `GET /api/services` – list service categories

## Auth
- `POST /api/auth/register` `{name,email,password,phone?,role?}`
- `POST /api/auth/login` `{email,password}` -> `{user,token}`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Products
- `GET /api/products?category=&q=&tag=`
- `GET /api/products/:id`
- `POST /api/products` (admin)
- `PUT /api/products/:id` (admin)
- `DELETE /api/products/:id` (admin)

## Cart
- `GET /api/cart/:userId`
- `POST /api/cart/add` `{userId,productId,qty?}`
- `POST /api/cart/remove` `{userId,productId}`
- `POST /api/cart/clear` `{userId}`
- `POST /api/checkout` `{userId,address?,deliveryDate?}`

## Orders
- `GET /api/orders/user/:userId`
- `GET /api/orders/:id`
- `POST /api/orders/status` `{orderId,status}`

## Appointments
- `GET /api/appointments/user/:userId`
- `POST /api/appointments` `{userId,service,date,time?,provider?,notes?}`
- `POST /api/appointments/cancel` `{id}`

## Bills
- `GET /api/bills/user/:userId`
- `POST /api/bills` `{userId,type,provider,amount,dueDate}`
- `POST /api/bills/pay` `{billId}`

## Profile
- `GET /api/profile/:userId`
- `POST /api/profile` `{userId,...}`

## Medications
- `GET /api/medications/user/:userId`
- `POST /api/medications` `{userId,name,dosage?,schedule?,times?,startDate?,endDate?,notes?}`
- `PUT /api/medications/:id`
- `DELETE /api/medications/:id`
- `POST /api/medications/log` `{medicationId,taken,timestamp?,note?}`
- `GET /api/medications/user/:userId/adherence`

## Vitals
- `GET /api/vitals/user/:userId?type=`
- `POST /api/vitals` `{userId,type,value,unit?,timestamp?,notes?}`
- `DELETE /api/vitals/:id`

## Subscriptions
- `GET /api/subscriptions/user/:userId`
- `POST /api/subscriptions` `{userId,productId,frequency?,qty?,nextDate?}`
- `PUT /api/subscriptions/:id` `{status?,nextDate?,qty?}`
- `POST /api/subscriptions/process` (admin)

## Reviews
- `GET /api/reviews?productId=`
- `POST /api/reviews` `{userId,productId,rating,comment?}`

## Deliveries
- `POST /api/deliveries` `{orderId,userId,address?,preferredDate?,timeSlot?}`
- `GET /api/deliveries/user/:userId`

## Notifications
- `GET /api/notifications/user/:userId`
- `POST /api/notifications/read` `{id}`
- `POST /api/notifications/read-all` `{userId}`

## SOS
- `POST /api/sos` `{userId,location?}`

## Admin
- `GET /api/admin/stats` (admin)
- `GET /api/admin/users` (admin)

## Export
- `GET /api/export/user/:userId` (auth)

## USSD
- `POST /ussd` (form-encoded: phoneNumber, text, sessionId) -> text/plain `CON`/`END` response (Africa's Talking compatible)
## Companion – Provider
- `GET /api/provider/appointments` (provider/admin) – scheduled appointments.
- `POST /api/provider/appointments/status` `{id,status}` – update status
  (scheduled, confirmed, completed, cancelled, no_show).

## Companion – Caregiver
- `GET /api/caregiver/overview/:patientId` (caregiver/admin) – patient
  summary including appointments, medications, vitals, orders, SOS events.

## Companion – Delivery
- `GET /api/delivery/pending` (delivery/admin) – pending deliveries.
- `POST /api/delivery/status` `{id,status}` – update status
  (scheduled, in_transit, delivered, failed).

## Admin
- `GET /api/admin/stats` (admin)
- `GET /api/admin/users` (admin)
- `POST /api/subscriptions/process` (admin)

## Export
- `GET /api/export/user/:userId` (auth) – full personal data export.

## USSD
- `POST /ussd` (form-encoded: phoneNumber, text, sessionId) ->
  text/plain `CON`/`END` response (Africa's Talking compatible).

## SMS Gateway (Twilio-style)
- `POST /sms` (form or JSON: From/Body or from/body) -> TwiML response.

## WhatsApp Gateway
- `POST /whatsapp` (form or JSON) -> JSON `{reply}`.

## Webhook (Facebook Messenger)
- `GET /webhook?hub.verify_token=...&hub.challenge=...` – verification.
- `POST /webhook` – event receiver.

## Status Enums
- Orders: placed, confirmed, processing, shipped, delivered, cancelled.
- Deliveries: scheduled, in_transit, delivered, failed.
- Appointments: scheduled, confirmed, completed, cancelled, no_show.
- Subscriptions: active, paused, cancelled.
- Bills: unpaid, paid.
