# QR Studio · PXG Tequila

Aplicación web para importar inventario, capturar artículos manualmente y crear etiquetas QR listas para imprimir en Word.

## Funciones

- Importa la primera hoja de archivos **Excel `.xlsx`** o archivos **CSV**. Los encabezados comunes en español o inglés se sugieren automáticamente y pueden corregirse antes de importar. Los archivos antiguos `.xls` deben guardarse como `.xlsx` o `.csv`.
- Captura y corrige números de parte, descripción, locación, cantidad, PO y fecha antes de generar. Cantidad inicia en `1`, fecha en hoy, PO es opcional y el número FIFO se asigna secuencialmente al lote.
- Genera un QR por registro, incluyendo siempre número de parte y cantidad. El contenido predeterminado es JSON compacto; se puede incluir el registro completo desde Formato.
- Ofrece dos plantillas basadas en los ejemplos: **8 etiquetas compactas (2 columnas × 4 filas)** o **3 etiquetas ampliadas (1 columna × 3 filas)** por página, en papel Carta o A4.
- Permite recorrer la vista previa de todas las hojas generadas y exporta un documento Word `.docx` con las páginas del lote.

## Uso

1. Inicia con la muestra ficticia o carga un inventario `.xlsx`/`.csv`.
2. Confirma el mapeo de columnas y corrige los campos marcados para revisión.
3. Elige Compacta o Ampliada, el papel y el inicio de la secuencia FIFO.
4. Revisa la primera hoja y genera el Word.

La plantilla `plantilla-inventario.xlsx` contiene los encabezados **Numero de parte**, **Descripcion**, **Locacion**, **Cantidad**, **PO** y **Fecha**. Las filas de ejemplo son ficticias; reemplázalas con los datos propios antes de importar.

## Privacidad

La lectura del inventario, la generación del QR y la exportación Word ocurren en el navegador. La aplicación no envía los archivos, registros ni credenciales a un servidor y no guarda el inventario en una base de datos. La muestra incluida es ficticia y los cambios de la tabla se mantienen únicamente en la sesión actual.

## Desarrollo

Requiere Node.js y pnpm 10.28.0. Desde la raíz del proyecto:

```bash
pnpm install
pnpm dev
```

Verificación local:

```bash
pnpm check
pnpm test
pnpm build
```
