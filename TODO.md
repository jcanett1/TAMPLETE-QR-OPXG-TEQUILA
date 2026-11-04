# TODO — QR PXG Tequila

## 1. Importación, captura y revisión de artículos
- [x] Permitir subir un documento de Excel con información de los artículos y generar las etiquetas a partir de sus registros.
- [x] Permitir capturar manualmente uno o varios artículos.
- [x] Incluir en cada registro número de parte, descripción y locación.
- [x] Mantener la fecha existente, usando la fecha actual cuando no se proporciona.
- [x] Validar los registros importados o capturados y permitir corregir los datos antes de generar las etiquetas.
- [x] Quitar FIFO, cantidad y PO/orden de la captura, importación, plantilla Excel y ajustes, ya que no se ocupan en este sistema.

## 2. QR y datos de etiqueta
- [x] Generar automáticamente un código QR por artículo incluyendo número de parte; no incluir FIFO, cantidad ni PO/orden en ningún modo QR.
- [x] Mostrar en la etiqueta número de parte, descripción, locación y fecha, conservando la legibilidad y la jerarquía del ejemplo aportado; quitar FIFO, cantidad y PO/orden de la vista previa y Word.

## 3. Plantillas, vista previa y exportación
- [x] Ofrecer un formato de etiquetas pequeñas distribuido en 2 columnas y 4 filas por hoja, siguiendo el ejemplo proporcionado.
- [x] Ofrecer un formato de etiquetas grandes apilado verticalmente en 3 filas por hoja, siguiendo el ejemplo proporcionado.
- [x] Permitir previsualizar todas las hojas generadas antes de imprimir o descargar.
- [x] Exportar las plantillas seleccionadas a un documento de Word listo para impresión, respetando el formato y la distribución seleccionados.

## Inventario propio
- [x] Iniciar sin artículos ficticios ni controles DEMO, conservando carga Excel y captura manual.
- [x] Descargar la plantilla Excel con encabezados y una fila vacía, sin productos de ejemplo.

## 4. Descarga Word e impresión
- [x] Evitar que Word estire caracteres en los textos de las etiquetas y permitir saltos de línea naturales.
- [x] Abrir el diálogo nativo de impresión/vista previa desde el sistema e imprimir el lote completo, no solo la hoja visible.
- [x] Respetar papel Carta/A4 y las retículas compacta 2×4 o ampliada 1×3.

## 5. Contenido QR y locación
- [x] Escanear número de parte y locación como texto simple, sin la clave `partNumber`, llaves ni comillas JSON.
- [x] Mantener el registro completo como texto simple con parte, descripción, locación y fecha.
- [x] Mostrar solo el valor de locación en Word, sin el prefijo `LOCATION:`.

## 6. Persistencia local y reemplazo de carga
- [x] Guardar automáticamente en este navegador los artículos capturados/importados y los ajustes para que sigan disponibles al recargar la página; no enviar el inventario a un servidor.
- [x] En Artículos, junto a Plantilla Excel y Cargar Excel, ofrecer Eliminar carga para dejar el inventario vacío, listo para cargar un archivo nuevo.
- [x] Pedir confirmación antes de eliminar todos los registros importados o capturados manualmente y conservar los ajustes de formato.
