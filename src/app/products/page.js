// /products fue renombrado a /courses — esta página solo redirecciona.
// El redirect también está en next.config.mjs para que se aplique sin renderizar.
import { redirect } from "next/navigation";

export default function ProductsPage() {
  redirect("/courses");
}
