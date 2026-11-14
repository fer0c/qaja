# Spec: sesiones del API — `POST /sessions`

| | |
|---|---|
| **Estado** | Borrador |
| **Fecha** | 2026-11-14 |
| **Implementa** | Backend (`api/`, FastAPI) |
| **Consume** | `web/` (Next.js, solo del lado servidor) |

## Resumen

Toda comunicación con el API ocurre dentro de una **sesión**. Para obtenerla, `web` envía a `POST /sessions` un número telefónico cifrado con un secreto compartido (`APP_SECRET`). El API descifra el número, valida que pertenezca a un usuario en **Authgear** (donde viven nuestros usuarios) y responde con un token de sesión. Ese token acompaña a todas las demás peticiones.

Este documento define el **contrato** del endpoint: qué se envía, qué se recibe y qué errores existen. Dónde y cómo se guardan las sesiones, cómo se consulta Authgear y qué formato interno tiene el token son decisiones de backend y quedan fuera de este spec.

## Flujo

1. `web` arma un JSON con el número telefónico y lo cifra con `APP_SECRET`.
2. `web` llama `POST /sessions` con ese payload cifrado.
3. El API descifra, valida el número contra Authgear y crea la sesión.
4. El API responde con `session_token` y `expires_at`.
5. `web` envía `Authorization: Bearer <session_token>` en cada petición posterior.

## Secreto compartido

- `APP_SECRET` son 32 bytes aleatorios codificados en base64url sin padding (43 caracteres).
- Se genera con `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`.
- El mismo valor se configura como variable de entorno en `web` y en `api`.
- Solo vive del lado servidor: nunca en variables `NEXT_PUBLIC_*` ni en el navegador.

## `POST /sessions`

Crea una sesión. Junto con `GET /health` y `GET /`, es el único endpoint que no requiere sesión.

### Request

```http
POST /sessions
Content-Type: application/json

{ "payload": "<JWE compacto>" }
```

| Campo | Tipo | Descripción |
|---|---|---|
| `payload` | string | JWE en serialización compacta (RFC 7516). |

### Payload cifrado

JWE compacto con header protegido `{"alg":"dir","enc":"A256GCM"}`. La llave son los 32 bytes de `APP_SECRET`. El contenido cifrado es un JSON con estos claims, todos obligatorios:

| Claim | Tipo | Descripción |
|---|---|---|
| `phone_number` | string | Número en E.164: `+`, código de país y número, sin espacios ni guiones. Ejemplo: `+525512345678`. |
| `iat` | number | Momento de emisión, en segundos Unix. |
| `exp` | number | Expiración, en segundos Unix. `web` lo emite como `iat + 60`. |
| `jti` | string | UUID v4 único por petición. |

Validaciones que hace el API:

- Rechaza cualquier `alg` o `enc` distinto a los indicados.
- Rechaza el payload si `exp` ya pasó o si está a más de 5 minutos en el futuro. La tolerancia de reloj es de 30 segundos.
- Acepta cada `jti` una sola vez. Un payload repetido se rechaza aunque siga vigente.

Así lo genera `web`, como referencia del formato:

```ts
import { EncryptJWT, base64url } from "jose";

const key = base64url.decode(process.env.APP_SECRET!);

const payload = await new EncryptJWT({ phone_number: "+525512345678" })
  .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
  .setIssuedAt()
  .setExpirationTime("60s")
  .setJti(crypto.randomUUID())
  .encrypt(key);
```

### Respuesta: `201 Created`

```json
{
  "session_token": "kq3Zc0V7mXh1...",
  "token_type": "Bearer",
  "expires_at": "2026-11-15T18:30:00Z",
  "user": {
    "id": "3f6c1a2e-8b4d-4c7a-9e21-5d0f7b6a1c93",
    "phone_number": "+525512345678"
  }
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `session_token` | string | Cadena opaca. `web` la guarda y la reenvía tal cual, sin interpretarla. |
| `token_type` | string | Siempre `"Bearer"`. |
| `expires_at` | string | Fecha de expiración en ISO 8601, UTC. La duración la define backend; `web` solo se guía por este valor. |
| `user.id` | string | Identificador estable del usuario en Authgear. |
| `user.phone_number` | string | Número del usuario en E.164. |

La respuesta lleva `Cache-Control: no-store`.

Cada llamada exitosa crea una sesión nueva y no invalida las sesiones anteriores del mismo usuario.

### Errores

Todos los errores del API usan este formato:

```json
{ "error": { "code": "user_not_found", "message": "Texto legible para diagnóstico." } }
```

`code` es estable y es lo único que `web` evalúa. `message` es libre y solo sirve para logs.

| HTTP | `code` | Cuándo ocurre |
|---|---|---|
| 400 | `invalid_request` | El body no es JSON válido, falta `payload`, o al contenido descifrado le falta un claim obligatorio. |
| 401 | `invalid_payload` | No se pudo descifrar: secreto distinto, payload alterado, o `alg`/`enc` no permitido. |
| 401 | `payload_expired` | `exp` ya pasó o está demasiado lejos en el futuro. |
| 401 | `payload_replayed` | El `jti` ya se había usado. |
| 422 | `invalid_phone_number` | `phone_number` no está en E.164. |
| 404 | `user_not_found` | No existe un usuario en Authgear con ese número. |
| 403 | `user_disabled` | El usuario existe en Authgear pero está deshabilitado. |
| 503 | `identity_provider_unavailable` | Authgear no respondió. `web` puede reintentar, siempre con un payload nuevo. |

## Uso de la sesión

Todos los endpoints, excepto `POST /sessions`, `GET /health` y `GET /`, exigen este header:

```http
Authorization: Bearer <session_token>
```

El API identifica al usuario a partir de la sesión. Ningún endpoint protegido recibe el número telefónico ni el id de usuario como parámetro para saber quién llama.

| HTTP | `code` | Cuándo ocurre |
|---|---|---|
| 401 | `session_invalid` | Falta el header, está mal formado, o el token no existe o fue revocado. |
| 401 | `session_expired` | El token existió pero ya expiró. |

Ante cualquiera de los dos, `web` descarta el token y pide una sesión nueva con `POST /sessions`.

## Vector de prueba

Sirve para comprobar el descifrado sin depender de `web`. El secreto es **solo de prueba** (bytes `0x00` a `0x1f`) y no debe usarse en ningún ambiente.

```text
APP_SECRET = AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8

payload    = eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..OSph7pfd9GzFC8sO.bUMaKkOyimZ-s92cgZpHGRh7jRcYAaqmJ1BTyAsgi_HVHzjQmQ_g7P88BHIbJYo3D1g1cshh2xiPM9s3jsudEt0QuQaW5Z7a9w2h6r1zpH0Wf9CakuKLmUDzKbfsuk3xgGAGNJJlY2co8ACKNxnz.bA1_76CZEp-tYa0v1nHdZg
```

Contenido descifrado esperado:

```json
{
  "phone_number": "+525512345678",
  "iat": 1700000000,
  "exp": 1700000060,
  "jti": "00000000-0000-4000-8000-000000000000"
}
```

El vector se generó con `jose` (Node) y se descifró con `joserfc` (Python). Su `exp` ya pasó, así que enviado al endpoint debe producir `401 payload_expired`.

## Criterios de aceptación

- [ ] Un payload válido con un número registrado en Authgear responde `201` con la forma descrita.
- [ ] El `session_token` devuelto permite llamar a un endpoint protegido.
- [ ] Un endpoint protegido sin header `Authorization` responde `401 session_invalid`.
- [ ] Un token expirado responde `401 session_expired`.
- [ ] Un payload cifrado con otro secreto responde `401 invalid_payload`.
- [ ] El vector de prueba se descifra al JSON esperado y el endpoint responde `401 payload_expired`.
- [ ] El mismo payload enviado dos veces responde `401 payload_replayed` la segunda vez.
- [ ] Un número que no existe en Authgear responde `404 user_not_found`.
- [ ] Todos los errores usan el formato `{ "error": { "code", "message" } }`.

## Supuestos por confirmar

1. **El API confía en `web`.** Este flujo no verifica que la persona sea dueña del número (no hay OTP aquí). Quien tenga `APP_SECRET` puede abrir sesión como cualquier usuario registrado, así que se asume que `web` ya autenticó a la persona antes de pedir la sesión.
2. **El endpoint no registra usuarios.** Un número que no existe en Authgear es un error, no un alta.
3. **Se permiten sesiones simultáneas** para un mismo usuario.
4. **No hay endpoint de logout ni de renovación** por ahora. Cuando la sesión expira, `web` pide una nueva.
