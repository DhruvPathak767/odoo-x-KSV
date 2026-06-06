import fitz  # PyMuPDF
import os

pdf_path = "Vendorbridge Hackathon Problem Statement.pdf"
output_path = "scratch/pdf_text.txt"

print(f"Reading PDF from: {pdf_path}")
doc = fitz.open(pdf_path)

text = ""
for i, page in enumerate(doc):
    text += f"\n--- PAGE {i+1} ---\n"
    text += page.get_text()

os.makedirs("scratch", exist_ok=True)
with open(output_path, "w", encoding="utf-8") as f:
    f.write(text)

print(f"Extraction complete. Saved to: {output_path}")
