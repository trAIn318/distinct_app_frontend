"use client";

import { Component } from "react";

/**
 * PanelBoundary — aísla una excepción de RENDER a un solo panel.
 *
 * Los dos paneles de la consola de pagos (la tabla de empresas y el catálogo de
 * la membresía) son hermanos a propósito y no uno dentro del otro, para que un
 * fallo de uno no se lleve al otro. Pero eso solo valía para los fallos de RED:
 * cada panel atrapa los suyos y ofrece reintentar. Una excepción durante el
 * render —un campo inesperado del backend, un `undefined` donde se esperaba una
 * lista— no la atrapa nadie, y en React tumba el árbol completo: se perdían los
 * DOS paneles.
 *
 * Importa cuál se pierde: el catálogo es la única pantalla donde se ve un curso
 * muerto u oculto que ya se está cobrando. Que la tabla de empresas reviente no
 * puede esconder eso.
 *
 * Es una clase porque los límites de error en React solo existen como clase: no
 * hay equivalente con hooks. Es la única clase del proyecto, y por eso.
 */
export default class PanelBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { fallo: false };
  }

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error, info) {
    // Se registra a propósito: un panel que desaparece sin dejar rastro es un
    // reporte de "la pantalla está rara" imposible de atender. No lleva datos
    // de la persona, solo el error y dónde ocurrió.
    console.error("Un panel de la consola de pagos reventó al pintarse:", error, info);
  }

  render() {
    if (this.state.fallo) return this.props.fallback ?? null;
    return this.props.children;
  }
}
