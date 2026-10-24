# Panel Admin Company — Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el jefe de una empresa cliente pueda incorporar y gestionar a su propio equipo, y que la persona invitada pueda activar su cuenta y quedar adentro.

**Architecture:** Cuatro cambios pequeños en el backend que son condición para los objetivos del diseño, y luego el frontend: una librería de lógica pura sin red ni React (donde vive la decisión de estado y la traducción de errores, y donde están la mayoría de las pruebas), las funciones de red en `src/lib/api.js`, y cuatro pantallas que consumen ambas.

**Tech Stack:** Backend Django 5.1 + DRF (repo `distinct_app_backend`). Frontend Next.js 16 App Router con **JavaScript** (no TypeScript), CSS modules, i18n propio del repo, Vitest + @testing-library/react (repo `distinct_app_frontend`).

**Spec:** `distinct_app_frontend/docs/superpowers/specs/2026-10-24-panel-admin-company-frontend-design.md`

## Global Constraints

Aplican a **todas** las tareas. Los valores son literales del spec y de `CLAUDE.md`, que es la fuente de verdad de diseño.

**Los dos repositorios**

- `distinct_app_backend`: **NUNCA** `makemigrations` ni `migrate` (base compartida en producción). Pruebas: `.venv\Scripts\python.exe manage.py test api --settings=distinct.settings_test`. Línea base actual: **486 tests OK**.
- `distinct_app_frontend`: pruebas con `npm test` (`vitest run`). **Sin dependencias nuevas.**
- Commits con el formato `[sección] qué se hizo`.

**Diseño (vinculante, de `CLAUDE.md`)**

- **Solo tokens de `src/styles/tokens.css`.** Ningún color, tamaño, tipografía o espaciado literal. Un valor arbitrario es un error.
- Paleta: obsidiana, marfil, oro, platino, humo. **Nunca `#000000` ni `#FFFFFF`.** El oro es acento: **máximo un elemento dorado por pantalla.**
- Botones y tarjetas **sin `border-radius`**; botones **sin sombra**, en mayúsculas con `letter-spacing`.
- Espaciado solo de los tokens `--space-*`.
- Tipografías: Cormorant Garamond para títulos (peso 300–400, **nunca negrita por encima de `--text-2xl`**), DM Sans para cuerpo e interfaz, **DM Mono para datos, etiquetas y cifras** (aplica a la columna de estado y a las fechas).
- **WCAG 2.1 AA:** contraste ≥ 4.5:1 en cuerpo, navegable por teclado (Tab, Enter, Escape), `<label>` asociado en todo campo (**no solo `placeholder`**), errores de validación **debajo del campo** y nunca en `alert()`.
- HTML semántico. **Móvil primero**, con `min-width` para escalar.
- Movimiento: entrada 0.6s con `cubic-bezier(0.16, 1, 0.3, 1)`, escalonado 0.08s, y **override obligatorio** en `@media (prefers-reduced-motion)`.
- **El estado de una persona nunca depende solo del color**: color + texto siempre.

**Frontend, convenciones del repo**

- Patrón de pantalla: `page.js` (servidor, título y marco, usa `getT`) + `XClient.js` (`"use client"`, toda la lógica, usa `useT`) + `page.module.css` + pruebas en `__tests__/`.
- Guard de página privada: `useEffect` con `isAuthenticated()` y `router.replace("/login?next=<ruta>")`.
- Red solo en `src/lib/api.js`. Cada función autenticada: `getAccessToken()`, `if (!token) throw new Error("You must be signed in.")`, `fetch` con `Authorization: Bearer`, `cache: "no-store"`, `await res.json().catch(() => ({}))`, y `if (!res.ok) throw new Error(data.detail || "<fallback en inglés>")`.
- Lógica pura (sin red, sin React) en `src/lib/<modulo>.js`.
- **Las pruebas corren SIN `I18nProvider`**, así que `useT` devuelve el **inglés** de `src/i18n/messages/en.json`. Toda aserción de texto va contra el inglés.
- Toda llamada de red en `async/await` con `try/catch`. **Ningún fallo silencioso.**

**Del dominio**

- Vigencia de la invitación: **72 horas** (la fija el backend).
- Carga por archivo: tope **50 filas**, **1 MB**.
- El panel **no muestra ni cambia roles**, y **no usa vocabulario del modelo de datos** en pantalla ("confirmado", "placeholder", "comp_id").

## Review Focus

Clases de entrada que el spec implica y que ninguna tarea ejercitaría por su cuenta. Cada línea tiene su prueba agregada a la tarea dueña del código.

1. **El backend no responde o está dormido** (Render free tarda ~60 s en despertar) al cargar el panel: debe mostrarse un error reintentable, y **jamás** el estado vacío de "empieza a invitar" — porque invitaría a actuar sobre datos que no se cargaron. Prueba en T7.
2. **Token ausente, basura o larguísimo** en la URL pública: la pantalla no puede romperse ni quedar en blanco; muestra el estado de enlace inválido. Prueba en T6.
3. **Miembro sin nombre ni apellido** (los 50 usuarios heredados pueden tenerlos vacíos): la fila debe seguir identificando a la persona por su correo, no quedar en blanco. Prueba en T4.
4. **Doble envío** del formulario de invitación o del botón de activar (doble clic, Enter repetido): no puede emitir dos invitaciones ni reportar dos éxitos; el botón se deshabilita mientras hay una petición en curso. Pruebas en T6 y T8.
5. **Archivo que no es CSV, de más de 1 MB o de más de 50 filas**: mensaje claro de la pantalla, sin romperse y sin enviar la petición cuando se puede saber antes. Prueba en T9.

---

## Tarea 1 — Backend: el listado le da al frontend lo que necesita

**Files:**
- Modify: `distinct_app_backend/api/company_admin_views.py` (`_member`, `_list_members`)
- Test: `distinct_app_backend/api/tests/test_company_admin_views.py`

**Interfaces:**
- Consumes: nada.
- Produces: `GET /api/company-admin/members/` acepta `?limit=` y `?offset=`; responde `{"members": [...], "invitations": [...], "total": <int>}`; cada miembro incluye `"last_login": <ISO 8601 o null>`.

- [ ] **Step 1: Escribir las pruebas que fallan**

En `test_company_admin_views.py`, clase nueva `MemberListContractTest(PanelApiMixin, APITestCase)`:

```python
def test_a_member_payload_carries_last_login(self):
    # usr_last_login ya existe en el modelo; sin exponerlo el frontend no
    # puede pintar "nunca ha entrado", que es un objetivo del diseno.
    nunca = make_user(usr_name="n1", usr_email="n1@x.com", rol_id=3, comp_id=7)
    ya = make_user(usr_name="y1", usr_email="y1@x.com", rol_id=3, comp_id=7,
                   usr_last_login=timezone.now())
    data = self._request(self.adm, "GET", MEMBERS).data
    por_correo = {m["email"]: m for m in data["members"]}
    self.assertIsNone(por_correo["n1@x.com"]["last_login"])
    self.assertIsNotNone(por_correo["y1@x.com"]["last_login"])

def test_the_list_is_paginated_and_reports_the_total(self):
    for i in range(7):
        make_user(usr_name=f"p{i}", usr_email=f"p{i}@x.com", rol_id=3, comp_id=7)
    data = self._request(self.adm, "GET", f"{MEMBERS}?limit=3&offset=0").data
    self.assertEqual(len(data["members"]), 3)
    self.assertEqual(data["total"], 8)          # 7 + el administrador

def test_an_absurd_limit_is_clamped_and_a_bad_one_ignored(self):
    # El limite viene de la URL: no puede tumbar la respuesta ni servir
    # la tabla entera porque alguien escriba limit=999999.
    for i in range(3):
        make_user(usr_name=f"c{i}", usr_email=f"c{i}@x.com", rol_id=3, comp_id=7)
    self.assertLessEqual(
        len(self._request(self.adm, "GET", f"{MEMBERS}?limit=999999").data["members"]),
        svc.MAX_PAGE_SIZE)
    self.assertEqual(
        self._request(self.adm, "GET", f"{MEMBERS}?limit=abc&offset=-5").status_code, 200)

def test_pagination_applies_to_members_and_not_to_invitations(self):
    # Las invitaciones pendientes son pocas por naturaleza y el frontend las
    # necesita completas para unirlas a la tabla; paginarlas romperia el conteo.
    self._post(self.adm, MEMBERS, {"email": "i1@x.com"})
    self._post(self.adm, MEMBERS, {"email": "i2@x.com"})
    data = self._request(self.adm, "GET", f"{MEMBERS}?limit=1").data
    self.assertEqual(len(data["invitations"]), 2)
```

- [ ] **Step 2: Correr y confirmar que fallan**

Run: `.venv\Scripts\python.exe manage.py test api.tests.test_company_admin_views.MemberListContractTest --settings=distinct.settings_test`
Expected: FAIL — `KeyError: 'last_login'` y `KeyError: 'total'`.

- [ ] **Step 3: Implementar**

En `api/company_admin_service.py`, junto a `LISTED_ROLES`, agregar:

```python
DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100
```

En `api/company_admin_views.py`:
- `_member(u)`: agregar `"last_login": u.usr_last_login.isoformat() if u.usr_last_login else None`.
- `_list_members`: leer `limit`/`offset` de `request.query_params`, convertir con un `try/except (TypeError, ValueError)` que caiga a `DEFAULT_PAGE_SIZE`/`0`, acotar `limit` a `[1, MAX_PAGE_SIZE]` y `offset` a `>= 0`; calcular `total = qs.count()` **antes** de cortar; devolver `qs[offset:offset + limit]`. Las invitaciones no se cortan.

- [ ] **Step 4: Correr y confirmar que pasan, y que nada más se rompió**

Run: `.venv\Scripts\python.exe manage.py test api --settings=distinct.settings_test`
Expected: PASS, 486 + 4 tests.

- [ ] **Step 5: Commit**

```bash
git add api/company_admin_views.py api/company_admin_service.py api/tests/test_company_admin_views.py
git commit -m "[api/company-admin] exponer last_login y paginar el listado de miembros"
```

---

## Tarea 2 — Backend: el alta individual y el reenvío dicen si el correo salió

**Files:**
- Modify: `distinct_app_backend/api/company_admin_service.py` (`issue_invitation`, `resend_invitation`)
- Modify: `distinct_app_backend/api/company_admin_views.py` (`_add_member`, `invitation_resend_view`)
- Test: `distinct_app_backend/api/tests/test_invitation_issue.py`

**Interfaces:**
- Consumes: nada.
- Produces: `issue_invitation(...)` y `resend_invitation(...)` devuelven `(inv, plain, email_sent: bool)`. `POST /api/company-admin/members/` y `POST .../invitations/<id>/resend/` incluyen `"email_sent": <bool>` en la respuesta.

- [ ] **Step 1: Escribir las pruebas que fallan**

```python
def test_issue_reports_a_failed_send_without_losing_the_invitation(self):
    with patch("api.company_admin_service.send_mail", side_effect=Exception("smtp")):
        inv, _plain, email_sent = svc.issue_invitation(
            "f1@x.com", 7, self.actor, self.req, KIND_NEW)
    self.assertFalse(email_sent)
    self.assertTrue(CompanyInvitation.objects.filter(id=inv.id).exists())

def test_issue_reports_a_successful_send(self):
    _inv, _plain, email_sent = svc.issue_invitation(
        "ok1@x.com", 7, self.actor, self.req, KIND_NEW)
    self.assertTrue(email_sent)

def test_resend_reports_a_failed_send(self):
    inv, _p, _s = svc.issue_invitation("r1@x.com", 7, self.actor, self.req, KIND_NEW)
    with patch("api.company_admin_service.send_mail", side_effect=Exception("smtp")):
        _inv, _plain, email_sent = svc.resend_invitation(inv, self.actor, self.req)
    self.assertFalse(email_sent)
```

Y en `test_company_admin_views.py`:

```python
def test_the_add_response_says_whether_the_email_went_out(self):
    with patch("api.company_admin_service.send_mail", side_effect=Exception("smtp")):
        res = self._request(self.adm, "POST", MEMBERS, {"email": "nf@x.com"})
    self.assertEqual(res.status_code, 201)
    self.assertFalse(res.data["email_sent"])
```

- [ ] **Step 2: Correr y confirmar que fallan**

Expected: FAIL — `ValueError: too many values to unpack` y `KeyError: 'email_sent'`.

- [ ] **Step 3: Implementar**

`_send_invitation_email` ya devuelve un booleano (`company_admin_service.py:443`) y la carga por archivo ya lo usa; aquí solo hay que **dejar de descartarlo** en las dos funciones que lo llaman sin capturarlo, devolverlo como tercer elemento de la tupla, y agregar `"email_sent"` a las dos respuestas. Actualizar los demás llamadores de esas dos funciones (los hay en las pruebas existentes y en `api/tests/`), que hoy desempacan dos valores.

- [ ] **Step 4: Correr la suite completa**

Expected: PASS. Si alguna prueba existente falla por desempacar dos valores, **ajustar la prueba** (es el contrato el que cambió, a propósito).

- [ ] **Step 5: Commit**

```bash
git commit -m "[api/company-admin] informar si el correo de invitacion salio"
```

---

## Tarea 3 — Backend: aceptar la invitación deja a la persona con sesión

**Files:**
- Modify: `distinct_app_backend/api/invitation_views.py` (`invitation_accept_view`)
- Test: `distinct_app_backend/api/tests/test_invitation_accept.py`

**Interfaces:**
- Consumes: nada.
- Produces: `POST /api/invitations/<token>/accept/` responde `200` con el mismo cuerpo que el login: `{"access": ..., "refresh": ..., "user": {...}}`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```python
def test_accepting_returns_a_usable_session(self):
    _inv, token = svc.issue_invitation(
        "s1@x.com", 7, self.actor, _fake_request(self.actor), KIND_NEW)[:2]
    res = self.client.post(ACCEPT % token,
                           {"password": "Correct123!", "confirm_password": "Correct123!",
                            "accept_policy": True},
                           content_type="application/json")
    self.assertEqual(res.status_code, 200)
    for clave in ("access", "refresh", "user"):
        self.assertIn(clave, res.data)
    self.assertEqual(res.data["user"]["id"],
                     Users.objects.get(usr_email="s1@x.com").usr_id)

def test_the_session_response_never_carries_the_token(self):
    _inv, token = svc.issue_invitation(
        "s2@x.com", 7, self.actor, _fake_request(self.actor), KIND_NEW)[:2]
    res = self.client.post(ACCEPT % token,
                           {"password": "Correct123!", "confirm_password": "Correct123!",
                            "accept_policy": True},
                           content_type="application/json")
    self.assertNotIn(token, str(res.data))
```

- [ ] **Step 2: Correr y confirmar que fallan**

Expected: FAIL — la respuesta es `{"detail": "Invitation accepted."}` y no trae `access`.

- [ ] **Step 3: Implementar**

En `api/invitation_views.py`, reemplazar `return Response({"detail": "Invitation accepted."})` por la sesión. `accept_invitation` ya devuelve el `user`. Importar el helper existente: `from api.views import _login_success_response` — verificado que **no hay ciclo de imports** (`api/views.py` no importa `invitation_views`). Ese helper además actualiza `usr_last_login`, que es correcto aquí porque la persona acaba de entrar.

Si el import de un helper privado entre módulos molesta, la alternativa es moverlo a un módulo compartido; es una decisión de quien implementa, siempre que el cuerpo de la respuesta sea idéntico al del login.

- [ ] **Step 4: Correr la suite completa**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "[api/invitations] devolver sesion al aceptar la invitacion"
```

---

## Tarea 4 — Frontend: la lógica pura del panel

Toda la decisión que no necesita red ni React, donde vive la mayoría de las pruebas.

**Files:**
- Create: `distinct_app_frontend/src/lib/companyAdmin.js`
- Test: `distinct_app_frontend/src/lib/__tests__/companyAdmin.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `ROW_STATUS` — objeto congelado con las claves `ACTIVE`, `NEVER_ENTERED`, `INVITED`, `EXPIRED`, `DEACTIVATED`.
  - `buildRoster({ members, invitations })` → array de filas `{ key, kind: "member"|"invitation", id, email, displayName, status, canAct }` ordenado por `displayName` y luego `email`.
  - `memberStatus(member)` → una clave de `ROW_STATUS`.
  - `displayNameFor({ firstname, lastname, email })` → string.
  - `errorMessageFor(error, t)` → string traducido.
  - `previewCategoryKey(result)` → clave i18n para una de las cinco categorías.
  - `fileRejectionKey(file)` → `null` si el archivo sirve, o la clave i18n del problema.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
describe("memberStatus", () => {
  it("activo cuando esta activo y ya entro", () => { /* last_login presente */ });
  it("nunca ha entrado cuando esta activo y sin last_login", () => {});
  it("desactivado manda sobre nunca-ha-entrado", () => {});
  // NO debe mirar `confirmed`: en esta base solo 13 de 159 lo tienen y los 50
  // con empresa estan todos sin confirmar usando el sistema.
  it("ignora el campo confirmed por completo", () => {
    expect(memberStatus({ active: true, confirmed: false, last_login: "2026-01-01T00:00:00Z" }))
      .toBe(ROW_STATUS.ACTIVE);
  });
});

describe("displayNameFor", () => {
  it("usa nombre y apellido cuando estan", () => {});
  // Review Focus 3: los 50 heredados pueden tenerlos vacios.
  it("cae al correo cuando no hay nombre ni apellido", () => {
    expect(displayNameFor({ firstname: null, lastname: "", email: "a@x.com" })).toBe("a@x.com");
  });
  it("tolera solo nombre o solo apellido", () => {});
});

describe("buildRoster", () => {
  it("une miembros e invitaciones en una sola lista", () => {});
  it("una invitacion vencida queda con estado vencido", () => {});
  it("cada persona aparece exactamente una vez", () => {});
  it("marca canAct en falso para los pares administradores", () => {
    // rol_id 4 => el backend rechaza toda escritura; la fila no lleva acciones.
  });
  it("una invitacion se identifica por su correo porque no trae nombre", () => {});
  it("no revienta con listas vacias o ausentes", () => {
    expect(buildRoster({})).toEqual([]);
  });
});

describe("errorMessageFor", () => {
  it("traduce los casos conocidos del backend por su codigo", () => {});
  it("usa el texto del backend como ultimo recurso", () => {});
  it("da un mensaje generico cuando no hay ni codigo ni texto", () => {});
});

describe("fileRejectionKey", () => {
  // Review Focus 5
  it("rechaza lo que no es csv", () => {});
  it("rechaza por encima de 1 MB", () => {});
  it("acepta un csv normal", () => { expect(fileRejectionKey(csvOk)).toBeNull(); });
});
```

- [ ] **Step 2: Correr y confirmar que fallan**

Run: `npm test -- companyAdmin`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar `src/lib/companyAdmin.js`**

Sin red y sin React. `memberStatus` decide por `active` y `last_login` y **nunca** por `confirmed`. `buildRoster` concatena los miembros (con `canAct: member.rol_id === 3`) y las invitaciones (`canAct: true`, `displayName: email`) y ordena. `errorMessageFor` mapea los casos conocidos a claves i18n y deja el texto del backend como último recurso.

- [ ] **Step 4: Correr y confirmar que pasan**

Run: `npm test -- companyAdmin`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "[lib/companyAdmin] logica pura del panel: estados, roster y errores"
```

---

## Tarea 5 — Frontend: las funciones de red

**Files:**
- Modify: `distinct_app_frontend/src/lib/api.js`
- Test: `distinct_app_frontend/src/lib/__tests__/api.companyAdmin.test.js`

**Interfaces:**
- Consumes: nada.
- Produces, todas `async` y lanzando `Error` con el `detail` del backend:
  - `getInvitationInfo(token)` → `{ kind, company_name }` — **pública, sin token de sesión**
  - `acceptInvitation(token, { password, confirmPassword, acceptPolicy })` → la sesión
  - `getCompanyMembers({ q, limit, offset })` → `{ members, invitations, total }`
  - `addCompanyMember(email)` → `{ invitation, email_sent }`
  - `resendInvitation(id)` / `cancelInvitation(id)`
  - `updateCompanyMember(id, fields)` / `deactivateCompanyMember(id)` / `unlinkCompanyMember(id)`
  - `getImportTemplate()` → texto CSV
  - `previewMembersImport(file)` / `commitMembersImport(file)` → `{ total, counts, rows }`

- [ ] **Step 1: Escribir las pruebas que fallan**

Con `vi.stubGlobal("fetch", ...)`:

```js
it("acceptInvitation no manda Authorization: es publica", () => {});
it("getCompanyMembers manda el Bearer y arma el query", () => {});
it("lanza el detail del backend cuando la respuesta no es ok", () => {});
it("lanza 'You must be signed in.' si no hay token", () => {});
it("la carga de archivo manda FormData y NO fija Content-Type", () => {
  // El navegador debe poner el boundary del multipart; fijarlo a mano lo rompe.
});
```

- [ ] **Step 2: Correr y confirmar que fallan**

- [ ] **Step 3: Implementar en `src/lib/api.js`**

Mismo patrón que `deleteAccountApi` (`api.js:269`). Las dos públicas no llaman `getAccessToken()`. Las de archivo mandan `FormData` y **no** fijan `Content-Type`.

- [ ] **Step 4: Correr y confirmar que pasan**

- [ ] **Step 5: Commit**

```bash
git commit -m "[lib/api] endpoints del panel de empresa y de las invitaciones"
```

---

## Tarea 6 — Frontend: la pantalla pública de activación

**Files:**
- Create: `distinct_app_frontend/src/app/accept-invitation/page.js`
- Create: `distinct_app_frontend/src/app/accept-invitation/AcceptInvitationClient.js`
- Create: `distinct_app_frontend/src/app/accept-invitation/page.module.css`
- Create: `distinct_app_frontend/src/app/accept-invitation/__tests__/AcceptInvitationClient.test.js`
- Modify: `distinct_app_frontend/src/i18n/messages/en.json` y `es.json` (namespace nuevo `companyAdmin`)

**Interfaces:**
- Consumes: `getInvitationInfo`, `acceptInvitation` (T5); `errorMessageFor` (T4).
- Produces: la ruta `/accept-invitation`, que es el destino del enlace del correo.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
it("sin token muestra el estado de enlace invalido y no llama al backend", () => {});
it("con un token basura o larguisimo muestra el mismo estado y no revienta", () => {});
// Review Focus 2

it("cuenta nueva: pide contrasena dos veces Y la casilla de consentimiento", () => {});
it("no envia si falta el consentimiento, y el error sale debajo del campo", () => {});
it("no muestra ningun correo, porque el backend no lo devuelve", () => {});
it("cuenta existente (join): un solo boton, sin campos de contrasena", () => {});
it("al activar con exito navega adentro", () => {});
it("un 404 del backend muestra el estado unico con sus dos salidas", () => {});
it("doble clic en activar envia UNA sola vez", () => {});
// Review Focus 4
```

- [ ] **Step 2: Correr y confirmar que fallan**

- [ ] **Step 3: Implementar**

`page.js` con `metadata` y `getT("companyAdmin")`. El cliente lee el token con `useSearchParams()`, llama `getInvitationInfo` en `useEffect`, y renderiza una de cuatro cosas: cargando, variante de cuenta nueva, variante de un clic, o el estado de enlace que no sirve.

Textos nuevos en los dos JSON, con el inglés como el que asertan las pruebas. La casilla de consentimiento lleva un enlace a `/privacy-policy`, que ya existe.

- [ ] **Step 4: Correr y confirmar que pasan**

- [ ] **Step 5: Commit**

```bash
git commit -m "[accept-invitation] pantalla publica de activacion, dos variantes"
```

---

## Tarea 7 — Frontend: el panel, su tabla y sus tres estados especiales

**Files:**
- Create: `distinct_app_frontend/src/app/settings/admin-company/page.js`
- Create: `distinct_app_frontend/src/app/settings/admin-company/AdminCompanyClient.js`
- Create: `distinct_app_frontend/src/app/settings/admin-company/page.module.css`
- Create: `distinct_app_frontend/src/app/settings/admin-company/__tests__/AdminCompanyClient.test.js`
- Modify: los dos JSON de i18n

**Interfaces:**
- Consumes: `getCompanyMembers` (T5); `buildRoster`, `ROW_STATUS`, `errorMessageFor` (T4).
- Produces: la ruta `/settings/admin-company`; el componente expone la tabla donde T8 engancha las acciones.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
it("sin sesion redirige a login con ?next=/settings/admin-company", () => {});
it("pinta una fila por persona con su estado en texto, no solo color", () => {});
it("el estado 'nunca ha entrado' aparece para quien no tiene last_login", () => {});
it("busca por nombre y por correo", () => {});
it("pagina y muestra el total", () => {});

// Review Focus 1 — la mas importante de esta tarea
it("si la carga falla NO muestra el estado vacio, muestra error con reintentar", async () => {
  getCompanyMembers.mockRejectedValue(new Error("Failed to fetch"));
  render(<AdminCompanyClient />);
  await waitFor(() => expect(screen.getByRole("button", { name: /retry|reintentar/i })).toBeInTheDocument());
  expect(screen.queryByText(/start by inviting|empieza/i)).not.toBeInTheDocument();
});

it("empresa vacia de verdad: muestra el estado de 'empieza a invitar'", () => {});
it("sin permiso (403) muestra el estado de sin acceso, no un panel roto", () => {});
it("administrador sin empresa (400) muestra su propio estado, no 'empieza a invitar'", () => {});
```

- [ ] **Step 2: Correr y confirmar que fallan**

- [ ] **Step 3: Implementar**

Distinguir con cuidado **tres** situaciones que parecen la misma: carga fallida, empresa vacía, y sin acceso. El estado de "empieza a invitar" se muestra **solo** cuando la carga fue exitosa y el roster quedó vacío.

- [ ] **Step 4: Correr y confirmar que pasan**

- [ ] **Step 5: Commit**

```bash
git commit -m "[settings/admin-company] tabla de personal con estados y estados de borde"
```

---

## Tarea 8 — Frontend: las acciones sobre una persona

**Files:**
- Modify: `AdminCompanyClient.js`, `page.module.css`, los dos JSON
- Test: el `__tests__` de la T7

**Interfaces:**
- Consumes: `addCompanyMember`, `resendInvitation`, `cancelInvitation`, `updateCompanyMember`, `deactivateCompanyMember`, `unlinkCompanyMember` (T5).
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
it("invitar por correo recarga la lista", () => {});
it("si el correo no salio, lo dice y ofrece reenviar", () => {});
// el email_sent de T2 es lo que hace esto posible
it("doble clic en invitar envia UNA sola vez", () => {});   // Review Focus 4
it("un 409 de 'ya es miembro' se muestra traducido, no en el idioma del backend", () => {});
it("reenviar y cancelar actuan sobre la invitacion correcta", () => {});
it("desactivar pide confirmacion y explica que se puede revertir", () => {});
it("desvincular pide confirmacion y explica en que se diferencia de desactivar", () => {});
it("las filas de los pares administradores no muestran botones de accion", () => {});
```

- [ ] **Step 2: Correr y confirmar que fallan**

- [ ] **Step 3: Implementar**

Cada mutación recarga el listado al terminar, como hace `PropertiesClient`. Los dos diálogos destructivos explican la diferencia entre desactivar y desvincular **sin** usar vocabulario del modelo.

- [ ] **Step 4: Correr y confirmar que pasan**

- [ ] **Step 5: Commit**

```bash
git commit -m "[settings/admin-company] invitar, reenviar, cancelar, editar, desactivar y desvincular"
```

---

## Tarea 9 — Frontend: la carga por archivo en dos pasos

**Files:**
- Create: `distinct_app_frontend/src/app/settings/admin-company/import/page.js`
- Create: `distinct_app_frontend/src/app/settings/admin-company/import/ImportMembersClient.js`
- Create: `distinct_app_frontend/src/app/settings/admin-company/import/page.module.css`
- Create: `.../import/__tests__/ImportMembersClient.test.js`
- Modify: los dos JSON

**Interfaces:**
- Consumes: `getImportTemplate`, `previewMembersImport`, `commitMembersImport` (T5); `previewCategoryKey`, `fileRejectionKey` (T4).

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
it("ofrece descargar la plantilla", () => {});
it("la previsualizacion muestra las CINCO categorias con palabras del jefe", () => {});
it("no escribe nada hasta confirmar", () => {});
it("el resultado dice fila por fila que paso", () => {});
it("nombra a quien no le llego el correo", () => {});
// Review Focus 5
it("un archivo que no es csv se rechaza en la pantalla, sin llamar al backend", () => {});
it("un archivo de mas de 1 MB se rechaza en la pantalla", () => {});
it("un 422 del backend por mas de 50 filas se muestra con su mensaje", () => {});
```

- [ ] **Step 2: Correr y confirmar que fallan**

- [ ] **Step 3: Implementar**

Dos pasos explícitos en una misma pantalla: elegir archivo → ver qué pasaría → confirmar. Lo que se puede saber antes (extensión, tamaño) se rechaza sin llamar al backend.

- [ ] **Step 4: Correr y confirmar que pasan**

- [ ] **Step 5: Commit**

```bash
git commit -m "[settings/admin-company/import] carga por archivo en dos pasos"
```

---

## Tarea 10 — Frontend: conectar la entrada del menú

**Files:**
- Modify: `distinct_app_frontend/src/lib/menuTargets.js`
- Test: `distinct_app_frontend/src/lib/menuTargets.test.js`
- Create: `distinct_app_backend/docs/superpowers/ddl/roles_menu_admin_company.sql`

**Interfaces:**
- Consumes: la ruta de la T7.
- Produces: nada.

- [ ] **Step 1: Escribir la prueba que falla**

```js
it("settings/admin-company lleva al panel y no a En construccion", () => {
  expect(resolveMenuTarget("settings/admin-company"))
    .toEqual({ type: "route", href: "/settings/admin-company" });
});
```

- [ ] **Step 2: Correr y confirmar que falla**

Expected: FAIL — hoy devuelve `{ type: "route", href: "/coming-soon" }`.

- [ ] **Step 3: Implementar**

Una línea en `resolveMenuTarget`. La etiqueta i18n ya existe (`menu.adminCompany`, en inglés y español) y ya está mapeada en `MENU_LABEL_KEYS`.

- [ ] **Step 4: Correr y confirmar que pasa**

- [ ] **Step 5: Escribir el DDL de datos, SIN ejecutarlo**

`roles_menu_admin_company.sql`: un `DELETE` de la fila de `roles_menu` que le da la entrada del panel al rol **Editor** (rol 2), que **no tiene** el permiso `users.read` y por eso vería una opción muerta. Verificado contra la base: la entrada está asignada a los roles 1, 2 y 4, y solo 1 y 4 tienen el permiso. El archivo lleva en un comentario la consulta de verificación previa y la de reversa.

- [ ] **Step 6: Commit**

```bash
git commit -m "[lib/menuTargets] enrutar la entrada del panel de empresa"
```

---

## Cierre

- [ ] Suite completa de los dos repositorios en verde.
- [ ] Revisión de rama completa antes de mergear.
- [ ] Ejecutar `roles_menu_admin_company.sql` a mano, tras correr su consulta de verificación.
- [ ] Verificar en producción que `/accept-invitation` responde 200 y ya no 404.

### Lo que este plan NO implementa, y por qué

- **Asignar roles:** decisión del dueño del producto; los maneja el administrador de la plataforma.
- **Reclutamiento y hojas de vida:** otro sub-proyecto.
- **Pantallas de auditoría:** la bitácora se escribe; verla es otro sub-proyecto.
- **Que una cuenta de plataforma no cargue el `comp_id` de un cliente:** es un cambio de datos que decide el dueño del producto. Mientras tanto el filtro `LISTED_ROLES` cierra la exposición.
