import { organizationSchema } from "../lib/insightsSeo";

/**
 * Identidad de la empresa en JSON-LD: quien es, su logo y su correo de
 * contacto, en el formato que leen Google y los asistentes de IA.
 *
 * Existe como componente porque va en DOS sitios -- la portada y el indice de
 * /insights -- y la etiqueta `<script>` con `dangerouslySetInnerHTML` repetida
 * a mano en cada pagina es exactamente como terminan divergiendo. Un JSON-LD
 * mal formado se descarta entero y en silencio: la pagina se ve igual de bien
 * y la identidad simplemente no existe. De ahi que este probado.
 */
export default function OrganizationSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()) }}
    />
  );
}
