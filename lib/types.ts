export type Seccion = 'gondola' | 'ml' | 'tienda';

export type Resultado = {
  fuente: 'mercadolibre' | 'supermercado';
  seccion: Seccion;
  id: string;
  titulo: string;
  precio: number;
  imagen: string | null;
  link: string;
  cadena?: string;
  relevancia?: number;
};
