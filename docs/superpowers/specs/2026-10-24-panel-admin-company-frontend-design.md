# Diseño — Frontend del panel Admin Company

## 1. Intención y por qué ahora

El backend del panel de administración de compañía está construido, desplegado y
con su base de datos sembrada. No tiene interfaz, y una pieza que falta rompe el
flujo completo: **el correo de invitación lleva a `/accept-invitation`, que hoy
devuelve 404 en el sitio en vivo.** Cada invitación que se enviara hoy quemaría
un enlace de 72 horas sin que nadie pueda aceptarlo, y el envío reportaría éxito.

El motivo de fondo no es una queja de usuarios actuales. Es que **el producto
todavía no está completo y por eso no hay clientes**. Esta pantalla es parte de
completarlo: el modelo de crecimiento es que llegue una empresa, el
administrador de la plataforma le dé el rol de administrador de compañía al jefe,
y **ese jefe meta a su propio equipo** sin que el equipo de Distinct sea el
cuello de botella.

Consecuencia de diseño que se deriva de eso, y que conviene tener presente al
decidir detalles: **quien abre esta pantalla es el jefe de una empresa que acaba
de contratar el servicio**, no un usuario interno. La primera impresión cuenta, y
el acabado tiene que estar por encima del de una herramienta interna.

## 2. Objetivos

1. Que una persona invitada pueda **aceptar su invitación y quedar adentro con
   sesión**, y que vea un mensaje claro y con salidas cuando el enlace no sirve.
2. Que el jefe de una empresa pueda **meter a su equipo solo**: uno por uno por
   correo, o varios de una vez con un archivo.
3. Que el jefe **vea el estado de cada persona de un vistazo**: quién está
   usando la plataforma, quién tiene cuenta pero nunca entró, a quién le falta
   aceptar y a quién se le venció la invitación.
4. Que una empresa recién llegada, **sin nadie cargado**, vea una pantalla que
   la invita a empezar y no una tabla vacía.

## 3. No-objetivos

- **Asignar roles.** Decisión del dueño del producto: los roles los maneja el
  administrador de la plataforma por ahora. El panel no los muestra ni los
  cambia.
- **El módulo de reclutamiento** (cargar hojas de vida, buscar candidatos). Es
  otro sub-proyecto.
- **Autoservicio de registro de empresas.** El rol de administrador de compañía
  lo asigna el administrador de la plataforma.
- **Pantallas de auditoría.** La bitácora se escribe, pero verla es otro
  sub-proyecto.

## 4. Anti-objetivos

Cosas que harían fracasar esto aunque funcionara:

- **Que el jefe tenga que entender el modelo de datos.** No debe ver "confirmado",
  "placeholder", "comp_id" ni dos listas separadas que en su cabeza son una sola
  (su gente).
- **Que una invitación se pierda en silencio.** Si un correo no sale, el jefe
  tiene que enterarse y poder reenviarlo, no quedarse esperando.
- **Que la pantalla se sienta a medio hacer** cuando se la muestra a un cliente
  nuevo. Ver la sección 1.
- **Pedirle al jefe que haga de soporte técnico** de su propio equipo porque la
  pantalla no explica qué significa cada estado.

## 5. Restricciones

### 5.0 Documentos que gobiernan, y tres conflictos que hay que resolver

`CLAUDE.md` de este repositorio declara ser la fuente de verdad de toda decisión
de diseño y de código, y que gana sobre cualquier cosa que la contradiga salvo
que el PRD la anule explícitamente. Este diseño se somete a ella. Pero al
cotejarla aparecen tres desacuerdos con el repositorio real, y `CLAUDE.md` §7.6
exige señalarlos en vez de elegir uno en silencio:

1. **El PRD no cubre esta pantalla.** `PRD_Distinct_Hospitality_Redesign.txt` es
   el PRD del **sitio público de marketing**: no menciona el panel de
   administración, ni invitaciones, ni ninguna pantalla autenticada.
   `CLAUDE.md` §7.1 y §7.7 ordenan leer el PRD antes de escribir código y
   señalar sus huecos sin inventar texto de relleno. Aquí el hueco es total, así
   que **este documento hace de especificación de producto para esta sección**, y
   los textos de interfaz se escriben como parte del trabajo (nunca "lorem
   ipsum", nunca inventados sobre funcionalidad que no existe).
2. **La estructura de carpetas de `CLAUDE.md` §5.2 no es la del repositorio.**
   Describe `src/pages/` y `src/layouts/`; el repositorio usa `src/app/` con el
   App Router de Next.js, que es lo que están usando todas las pantallas
   existentes. **Se sigue el repositorio**, porque es código vivo y funcionando;
   `CLAUDE.md` §5.2 parece haber quedado de una etapa anterior del proyecto.
3. **`CLAUDE.md` §5.4 pide "Vanilla JS, no jQuery, módulos ES"** y prohíbe
   manejadores en línea. El repositorio es React/Next. **Se sigue el
   repositorio**, y el espíritu de esa regla se respeta donde aplica: sin
   dependencias nuevas, `async/await` con `try/catch` en toda llamada de red, y
   ningún fallo silencioso.

Los puntos 2 y 3 son lecturas mías de un documento desactualizado frente a
código que funciona. Si el dueño del producto prefiere lo contrario, cambia el
plan de implementación, no este diseño.

### 5.1 Del sistema de diseño (`CLAUDE.md`), que es vinculante

Esta pantalla la ve el jefe de un cliente nuevo, así que el acabado importa, y
el sistema de diseño ya está definido. Lo que ata:

- **Solo tokens.** Ningún color, tamaño, tipografía o espaciado literal: todo
  sale de `src/styles/tokens.css`. Un valor arbitrario es un error, no un
  detalle.
- **Paleta:** obsidiana, marfil, oro, platino, humo. Nunca negro ni blanco
  puros. **El oro es un acento: máximo un elemento dorado por pantalla.**
- **Esquinas rectas.** Sin `border-radius` en botones ni tarjetas, sin sombras
  en botones. Botones en mayúsculas con letra espaciada.
- **Espaciado por proporción áurea**, de los tokens `--space-*`.
- **Tipografías:** Cormorant Garamond para títulos (peso 300–400, nunca negrita
  por encima de `--text-2xl`), DM Sans para cuerpo e interfaz, **DM Mono para
  datos, etiquetas y cifras** — lo que aplica directo a la columna de estado y a
  las fechas de la tabla.
- **Accesibilidad WCAG 2.1 AA como mínimo:** contraste ≥ 4.5:1 en cuerpo,
  navegable por teclado (Tab, Enter, Escape), etiquetas `<label>` asociadas en
  todo campo —no solo `placeholder`—, y errores de validación debajo del campo,
  nunca en un `alert()`.
- **HTML semántico** y **móvil primero**, con `min-width` para escalar.
- **Movimiento contenido:** entradas de 0.6s con la curva expo-out ya definida,
  escalonado de 0.08s, y override obligatorio para `prefers-reduced-motion`.
  Nada elástico ni juguetón.
- El estado de cada persona **no puede depender solo del color**: eso rompería
  el contraste y dejaría fuera a quien no distingue colores. Color más texto.
- Commits con el formato `[sección] qué se hizo`.

### 5.2 Del stack y del repositorio

- Next.js con **App Router y JavaScript** (no TypeScript), CSS modules, y el
  sistema de i18n propio del repo (`useT` en cliente, `getT` en servidor, con
  los textos en `src/i18n/messages/{en,es}.json`). Decisión ya tomada por el
  proyecto: se sigue, no se cambia.
- El patrón de pantalla del repo es `page.js` (servidor, título y marco) +
  `XClient.js` (`"use client"`, toda la lógica) + `page.module.css` + pruebas en
  `__tests__/`. La lógica pura sin red ni React se extrae a `src/lib/<modulo>.js`
  para poder probarla. El precedente más cercano es
  `src/app/dashboard/analytics/properties/`.
- Las llamadas al backend viven en `src/lib/api.js`. Las autenticadas usan el
  token de `src/lib/session.js`.
- Guard de página privada: `useEffect` con `isAuthenticated()` y
  `router.replace("/login?next=<ruta>")`.

### 5.3 Del backend, tal como está hoy

- El listado devuelve **dos** colecciones: `members` (personas incorporadas) e
  `invitations` (pendientes, con una marca `expired` ya calculada). La unión en
  una sola lista es trabajo del frontend.
- El campo `confirmed` que devuelve el backend **no sirve para pintar estado**:
  en esta base solo lo marca el registro con código, y de 159 usuarios solo 13
  lo tienen, mientras los 50 que pertenecen a una empresa están todos sin
  confirmar y varios ya usan el sistema. Usarlo mostraría "sin confirmar" para
  miembros reales.
- La carga por archivo tiene **dos pasos**: una previsualización que informa qué
  pasaría con cada fila sin escribir nada, y una confirmación que emite las
  invitaciones. El tope es de **50 filas** por archivo.
- Tope de 72 horas de vigencia de la invitación, definido por el backend.
- Los textos de error del backend vienen en español y el frontend los prefiere
  sobre un mensaje genérico, como ya hace `PropertiesClient`.

### 5.4 Cambios de backend que esta pantalla necesita

Este plan cubre **los dos repositorios**: sin estos cambios hay objetivos y
anti-objetivos de este documento que no se pueden cumplir. Son todos pequeños.

1. **Devolver la sesión al aceptar la invitación.** Hoy el endpoint responde solo
   `{"detail": "Invitation accepted."}`. Decisión del dueño del producto: la
   persona debe quedar adentro. Mismo patrón que ya usa la verificación del
   registro con código.
2. **Exponer la fecha del último ingreso** en el listado de miembros. Sin ella el
   estado "nunca ha entrado" no se puede calcular, y es justamente el que el
   cliente pidió ver. El campo ya existe en el modelo; es un campo más en la
   respuesta.
3. **Informar si el correo de invitación salió**, en el alta individual y en el
   reenvío. Hoy ambos descartan ese resultado, mientras la carga por archivo sí
   lo captura y lo reporta fila por fila. Sin esto, el anti-objetivo "si un
   correo no sale, el jefe tiene que enterarse" solo se cumple en el archivo, y
   las otras dos vías afirmarían un éxito que no verificaron.
4. **Paginación del listado.** El documento de requisitos la exige (HU-AC-02) y
   hoy no existe: la respuesta es ilimitada. Con 32 personas en una empresa ya
   hace falta. El tamaño de página es decisión de la interfaz, y por eso se
   resolvió aquí y no en el backend original.

## 6. Las pantallas

### 6.1 Aceptar invitación — pública, sin sesión

Ruta `/accept-invitation`, con el token en la query. Es la única pantalla del
proyecto que se abre **sin estar autenticado**.

Al cargar, consulta el backend con el token. El backend devuelve **solo el tipo
de invitación y el nombre de la empresa**: deliberadamente **NO devuelve el
correo**, para no confirmarle a nadie que una dirección fue invitada. Así que la
pantalla da la bienvenida a la empresa, no a la persona por su correo.

**Hay dos variantes, según el tipo de invitación**, y el backend las distingue
en esa misma respuesta:

**(a) Cuenta nueva.** Pide una contraseña (dos veces) **y una casilla de
consentimiento de la política de tratamiento de datos, que es obligatoria**: el
backend rechaza la activación sin ella, y es el momento jurídicamente relevante
de todo el proceso (Habeas Data). La casilla va acompañada de un enlace a la
política, que ya existe como página pública en el sitio.

**(b) Cuenta que ya existe, sin empresa.** No pide contraseña ni consentimiento
—la persona ya los tiene— y es **un solo clic de confirmación**: "Te invitaron a
unirte a <empresa>. ¿Confirmas?". Si aquí se mostrara un formulario de
contraseña, el backend lo ignoraría y la persona habría escrito una contraseña
que se descarta en silencio.

**Al activar, la persona queda con sesión y entra directo.** Decisión del dueño
del producto. Hoy el endpoint responde solo "invitación aceptada" sin sesión, así
que **esto exige un cambio en el backend**: que la aceptación devuelva la sesión,
igual que ya hace la verificación del registro con código. Se prefirió sobre
mandarla a iniciar sesión porque le ahorra escribir la contraseña dos veces
seguidas en el primer minuto de uso, y esa es la primera impresión del producto.

#### Cuando el enlace no sirve

El backend responde **el mismo 404 para las cuatro causas** —token inexistente,
vencido, cancelado y ya usado— y lo hace a propósito, para no revelar si una
dirección fue invitada. Por lo tanto el frontend **no puede distinguirlas**, y
pretender lo contrario sería inventar información.

Es **una sola pantalla** para ese 404, con un texto que cubre las cuatro sin
afirmar cuál es, y dos salidas: iniciar sesión (si la cuenta ya estuviera
activa) y pedirle a su administrador que reenvíe la invitación. Esto corrige una
versión anterior de este documento que pedía tres mensajes distinguibles: la
restricción es del contrato de privacidad del backend, no un descuido.

El único caso que **sí** se distingue es un 409 "esta cuenta ya pertenece a una
empresa", que es otra situación y lleva su propio mensaje.

### 6.2 El panel — `/settings/admin-company`

Una sola tabla: **su gente**. Cada fila es una persona, aparezca una sola vez,
con su estado. Los estados y de dónde sale cada uno:

| Estado | De dónde se deduce |
|---|---|
| **Activo** | está en `members`, activo, y con fecha de último ingreso |
| **Nunca ha entrado** | está en `members`, activo, sin fecha de último ingreso |
| **Invitado** | está en `invitations` con `expired` en falso |
| **Invitación vencida** | está en `invitations` con `expired` en verdadero |
| **Desactivado** | está en `members` y no está activo |

Acciones, cada una contra un endpoint que ya existe: invitar por correo, cargar
un archivo, reenviar una invitación, cancelarla, editar los datos de una persona,
**desactivarla** y **desvincularla**.

**Desactivar y desvincular no son lo mismo y la pantalla tiene que explicarlo**,
sin usar vocabulario del modelo de datos: desactivar le quita el acceso pero la
persona sigue siendo del equipo (se puede reactivar); desvincular la saca del
equipo y conserva su cuenta, que es lo correcto cuando alguien se fue del hotel.
El diseño del backend es explícito en que **una cuenta activada nunca se borra**,
así que desvincular es la salida correcta y no podía quedar fuera.

**Filas sobre las que el jefe no puede actuar.** El listado incluye a sus pares
administradores de compañía, y el backend rechaza toda escritura sobre ellos. En
esas filas **no se muestran los botones de acción**, sin explicación: mostrarlos
deshabilitados obligaría a justificar por qué, y justificarlo exigiría hablar de
roles, que es justo lo que el panel no debe hacer. Dejar que devuelvan error es
el único resultado que los anti-objetivos descartan.

**Búsqueda.** El backend filtra con `?q=` **solo a los miembros**: las
invitaciones vuelven sin filtrar, y además no traen nombre —solo el correo—
porque los nombres viven en la cuenta y no en la invitación. Por lo tanto: el
filtro de miembros va al servidor, el de invitaciones se aplica en el navegador
sobre el correo, y **las filas invitadas muestran el correo como identificador**,
no un nombre vacío. Es una limitación real del backend, no una elección de
interfaz.

### 6.3 Estado vacío

Cuando la empresa no tiene a nadie —el caso de todo cliente nuevo, porque la
carga la hace el jefe y no el equipo de Distinct— la pantalla no muestra una
tabla con encabezados y nada debajo. Muestra una invitación a empezar: un campo
de correo visible y la opción de subir un archivo, con una línea que explique que
cada persona recibirá un correo para poner su propia contraseña.

### 6.4 Carga por archivo

Dos pasos, porque el backend los separa y porque conviene: primero se sube y la
pantalla muestra **qué va a pasar con cada fila** antes de escribir nada. Solo
entonces se confirma.

Las categorías que devuelve el backend, y que la pantalla debe nombrar en
palabras del jefe y no en las del código, son **cinco**: se va a invitar, se va a
invitar a unirse (una cuenta que ya existe sin empresa), ya es miembro, no se
puede incorporar, y fila inválida.

Sobre el "por qué" de una fila con problema: el backend devuelve un código por
fila y **no un motivo en texto**, y además agrupa en "inválida" dos casos
distintos —correo mal escrito y correo repetido dentro del mismo archivo—. La
pantalla dice las dos posibilidades en ese caso en vez de afirmar una sola; es
suficiente para que el jefe encuentre el problema en su archivo, y evita un
cambio de backend que no aporta más. Al terminar, el resultado dice fila por fila qué
ocurrió, **incluyendo a quién no le pudo llegar el correo**, para que el jefe
sepa a quién avisar por otra vía.

### 6.5 Entrada en el menú

El menú ya es data-driven y la entrada ya existe en la base de datos con su
etiqueta traducida en inglés y español. Hoy cae en "En construcción". Conectarla
es registrar la ruta en `src/lib/menuTargets.js`.

Aparte: esa entrada está asignada también al rol **Editor**, que no tiene el
permiso para usar el panel, así que hoy vería una opción muerta. Es un sobrante
de datos y se corrige con un borrado de una fila en `roles_menu`. No es código.

## 7. Lo que queda a criterio de quien implemente

- El tamaño de página del listado y si la paginación es por botones o por scroll.
- La disposición concreta de la tabla y del formulario, dentro de lo que ya usan
  las pantallas del repo.
- Si el estado se muestra como etiqueta de color, como texto o con un icono.
- Cómo se ordena la lista por omisión.
- Si editar una persona abre un formulario aparte o se hace en la misma fila
  (`PropertiesClient` ya tiene precedente de edición en la fila).
- Los textos exactos, en inglés y español, dentro de las restricciones de la
  sección 4 (nada de vocabulario del modelo de datos).
- Si la carga por archivo vive en la misma pantalla o en una aparte.

## 8. Decisiones que tomé yo, para que las pueda revisar

Un revisor leyó este documento como lo haría quien va a construirlo y levantó
once puntos. Dos los decidió el dueño del producto (la sesión al activar y
construir ya la variante de cuenta existente). Los otros nueve los resolví yo,
y son estos, para que pueda objetar cualquiera al leer:

1. **El plan cubre los dos repositorios.** Los cuatro cambios de la sección 5.4
   son condición para cumplir objetivos de este documento, así que no tiene
   sentido separarlos.
2. **Construir la variante de "cuenta existente" ahora**, cuando se me dejó
   elegir, porque **no construirla cuesta más trabajo**: el backend ya emite esas
   invitaciones, así que habría que bloquear el caso a mano o aceptar que el
   enlace pida una contraseña que se descarta en silencio.
3. **Una sola pantalla para el enlace que no sirve**, no tres. El backend
   colapsa las cuatro causas en el mismo 404 para no revelar si una dirección fue
   invitada; distinguirlas sería inventar información.
4. **Incluir desvincular**, que el diseño del backend señala como la forma
   correcta de sacar a alguien que se fue, y explicar en pantalla en qué se
   diferencia de desactivar.
5. **Las filas de los pares administradores se listan sin botones de acción**,
   sin explicación, porque explicarlo exigiría hablar de roles.
6. **Búsqueda mixta**: al servidor para miembros, en el navegador para
   invitaciones, porque el backend solo filtra las primeras.
7. **Las filas invitadas muestran el correo como identificador**, porque el
   backend no devuelve nombre en las invitaciones.
8. **El motivo de una fila inválida nombra las dos posibilidades** (correo mal
   escrito o repetido en el archivo), porque el backend no distingue cuál es.
9. **Los errores del backend se traducen**: los casos conocidos se mapean a
   textos propios en inglés y español, y el texto del backend queda solo como
   último recurso. Hoy esos mensajes están escritos en español dentro del código,
   y esta pantalla es la primera impresión de un cliente que puede estar en
   inglés.
10. **Dos estados de pantalla más** que el revisor echó en falta: uno para quien
    entra sin permiso (en vez de un panel que falla al cargar) y otro para un
    administrador cuya cuenta no está ligada a ninguna empresa, que hoy vería la
    pantalla de "empieza a invitar" y fallaría en cada intento.
