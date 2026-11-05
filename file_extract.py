def extract_file(upload):
    name = upload.name.lower()
    if name.endswith((".txt", ".md", ".py", ".json", ".csv", ".yaml", ".yml", ".toml", ".html", ".xml")):
        return upload.getvalue().decode("utf-8", errors="replace")[:25000]
    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            return "\n".join(p.extract_text() or "" for p in PdfReader(upload).pages)[:25000]
        except Exception as e:
            return f"تعذر قراءة PDF: {e}"
    if name.endswith(".docx"):
        try:
            from docx import Document
            return "\n".join(p.text for p in Document(upload).paragraphs)[:25000]
        except Exception as e:
            return f"تعذر قراءة DOCX: {e}"
    if name.endswith((".xlsx", ".xls")):
        try:
            import pandas as pd
            return pd.read_excel(upload).head(200).to_csv(index=False)[:25000]
        except Exception as e:
            return f"تعذر قراءة Excel: {e}"
    return f"الملف {upload.name}: هذا الإصدار لا يحلل الصور بعد. نحتاج نموذجًا يدعم الصور."
