# QR Studio · PXG Tequila

Aplicación web para importar inventario, capturar artículos manualmente y crear etiquetas QR listas para imprimir en Word.

## Funciones

- Importa la primera hoja de archivos **Excel `.xlsx`** o archivos **CSV**. Los encabezados comunes en español o inglés se sugieren automáticamente y pueden corregirse antes de importar. Los archivos antiguos `.xls` deben guardarse como `.xlsx` o `.csv`.
- Captura y corrige número de parte, descripción, locación y fecha antes de generar. La fecha inicia en hoy.
- Genera un QR por registro, incluyendo siempre el número de parte. El contenido predeterminado es JSON compacto; se puede incluir el registro completo desde Formato.
- Ofrece dos plantillas basadas en los ejemplos: **8 etiquetas compactas (2 columnas × 4 filas)** o **3 etiquetas ampliadas (1 columna × 3 filas)** por página, en papel Carta o A4.
- Permite recorrer la vista previa de todas las hojas generadas y exporta un documento Word `.docx` con las páginas del lote.

## Uso

1. La aplicación inicia vacía. Carga tu inventario `.xlsx`/`.csv` o agrega artículos manualmente.
2. Confirma el mapeo de columnas y corrige los campos marcados para revisión.
3. Elige Compacta o Ampliada, el papel y los datos del QR.
4. Revisa las hojas y genera el Word.

La plantilla `plantilla-inventario.xlsx` contiene los encabezados **Numero de parte**, **Descripcion**, **Locacion** y **Fecha**, además de una fila vacía para tus datos. No incluye registros de ejemplo.

## Privacidad

La lectura del inventario, la generación del QR y la exportación Word ocurren en el navegador. La aplicación no envía los archivos, registros ni credenciales a un servidor y no guarda el inventario en una base de datos. Los datos de la tabla se mantienen únicamente en la sesión actual.

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
