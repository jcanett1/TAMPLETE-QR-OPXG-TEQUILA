# TODO — QR PXG Tequila

## 1. Importación, captura y revisión de artículos
- [x] Permitir subir un documento de Excel con información de los artículos y generar las etiquetas a partir de sus registros.
- [x] Permitir capturar manualmente uno o varios artículos.
- [x] Incluir en cada registro número de parte, descripción y locación.
- [x] Incluir fecha, PO y cantidad; usar la fecha actual y cantidad 1 como valores iniciales cuando no se proporcionen, y permitir que el PO quede vacío.
- [x] Validar los registros importados o capturados y permitir corregir los datos antes de generar las etiquetas.
- [x] Generar un número FIFO secuencial para cada etiqueta del lote.

## 2. QR y datos de etiqueta
- [x] Generar automáticamente un código QR por artículo; el contenido del QR debe incluir el número de parte y la cantidad.
- [x] Mostrar en la etiqueta número de parte, descripción, locación, fecha, PO, cantidad y número FIFO, conservando la legibilidad y la jerarquía del ejemplo aportado.

## 3. Plantillas, vista previa y exportación
- [x] Ofrecer un formato de etiquetas pequeñas distribuido en varias columnas y filas por hoja, siguiendo el ejemplo proporcionado.
- [x] Ofrecer un formato de etiquetas grandes apilado verticalmente en una hoja, siguiendo el ejemplo proporcionado.
- [x] Permitir previsualizar las hojas generadas antes de imprimir o descargar.
- [x] Exportar las plantillas seleccionadas a un documento de Word listo para impresión, respetando el formato y la distribución seleccionados.
