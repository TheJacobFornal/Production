const { getPrinters, print } = require("pdf-to-printer");

async function main() {
  const printers = await getPrinters();

  const targetName = "KONICA MINOLTA bizhub 367 PS (10.1.69.90) UPD";

  const printer = printers.find((p) => p.name === targetName);

  if (!printer) {
    console.log("Nie znaleziono drukarki!");
    console.log(printers.map((p) => p.name));
    return;
  }

  const filePath =
    "C:\\Users\\JakubFornal\\Desktop\\PROJECTS\\Produkcja\\ProMate\\TEST_printing\\Test_wydruku.pdf";

  await print(filePath, {
    printer: printer.name,
  });

  console.log("Wysłano do KONICA MINOLTA");
}

main().catch(console.error);
