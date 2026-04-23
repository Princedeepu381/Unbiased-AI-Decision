from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.units import inch
import io

def calculate_overall_score(metrics):
    dir_score = min(metrics['dir'] / 0.8, 1) * 40
    dpd_score = max(1 - metrics['dpd'] / 0.1, 0) * 30
    eo_score = max(1 - metrics['eo'] / 0.1, 0) * 30
    return round(dir_score + dpd_score + eo_score)

def generate_pdf_report(data):
    """
    Generates a PDF fairness audit report.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor("#00F0FF"),
        spaceAfter=30,
        alignment=1 # Center
    )
    
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Heading2'],
        fontSize=18,
        textColor=colors.HexColor("#8A2BE2"),
        spaceBefore=20,
        spaceAfter=12
    )

    cert_style = ParagraphStyle(
        'CertStyle',
        parent=styles['BodyText'],
        fontSize=12,
        textColor=colors.HexColor("#00E5A0"),
        alignment=1,
        borderWidth=1,
        borderColor=colors.HexColor("#00E5A0"),
        borderPadding=10,
        spaceBefore=20,
        spaceAfter=20
    )
    
    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Code'],
        fontSize=8,
        textColor=colors.whitesmoke,
        backgroundColor=colors.HexColor("#050810"),
        borderPadding=10,
        leading=12
    )
    
    body_style = styles['BodyText']
    
    elements = []
    
    # Title
    elements.append(Paragraph("Aegis One - Fairness Audit Report", title_style))
    elements.append(Spacer(1, 0.2 * inch))
    
    # Executive Summary
    elements.append(Paragraph("Executive Summary", header_style))
    summary_text = (
        f"This report provides an algorithmic fairness audit for the dataset with protected attribute "
        f"<b>{data['protected_attr']}</b> and target column <b>{data['target_col']}</b>. "
        f"The analysis focuses on the privileged group: <b>{data['privileged_group']}</b>."
    )
    elements.append(Paragraph(summary_text, body_style))
    
    # Certification Check
    metrics = data['baseline_metrics']
    final_metrics = data.get('mitigated_metrics') or metrics
    score = calculate_overall_score(final_metrics)
    
    if score > 80:
        elements.append(Spacer(1, 0.3 * inch))
        elements.append(Paragraph(f"✓ AEGIS TRUST CERTIFIED - Fairness Score: {score}%", cert_style))
        elements.append(Paragraph("This model has been ethically validated and meets production compliance standards.", ParagraphStyle('SubCert', parent=body_style, alignment=1, fontSize=8, textColor=colors.grey)))
    else:
        elements.append(Spacer(1, 0.2 * inch))
        elements.append(Paragraph(f"Analysis Complete - Overall Fairness: {score}%", ParagraphStyle('ScoreOnly', parent=body_style, alignment=1, fontSize=10, fontWeight='bold')))

    elements.append(Spacer(1, 0.4 * inch))
    
    # Baseline Metrics
    elements.append(Paragraph("Fairness Performance Metrics", header_style))
    
    metric_data = [
        ["Metric", "Value", "Status"],
        ["Disparate Impact Ratio", f"{metrics['dir']:.3f}", "FAIL" if metrics['dir'] < 0.8 else "PASS"],
        ["Demographic Parity Diff", f"{metrics['dpd']:.3f}", "FAIL" if metrics['dpd'] > 0.05 else "PASS"],
        ["Equalized Odds Diff", f"{metrics['eo']:.3f}", "FAIL" if metrics['eo'] > 0.05 else "PASS"],
        ["Accuracy (Privileged)", f"{metrics['acc_priv']*100:.1f}%", "-"],
        ["Accuracy (Unprivileged)", f"{metrics['acc_unpriv']*100:.1f}%", "-"]
    ]
    
    t = Table(metric_data, colWidths=[2.5*inch, 1.5*inch, 1.5*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0A0F1A")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.whitesmoke),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey)
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.3 * inch))
    
    # AI Governance Trace
    elements.append(Paragraph("AI Governance Insights", header_style))
    trace_text = data.get('baseline_trace') or "No AI explanation generated."
    elements.append(Paragraph(trace_text.replace('\n', '<br/>'), body_style))
    elements.append(Spacer(1, 0.2 * inch))
    
    # Mitigation Results (if applicable)
    if 'mitigated_metrics' in data and data['mitigated_metrics']:
        elements.append(PageBreak())
        elements.append(Paragraph(f"Mitigation Strategy: {data.get('technique', 'Reweighing')}", header_style))
        
        m_metrics = data['mitigated_metrics']
        b_metrics = data['baseline_metrics']
        
        comp_data = [
            ["Metric", "Baseline", "Mitigated", "Improvement"],
        ]
        
        for row in [
            {"name": "Disparate Impact", "b": b_metrics['dir'], "a": m_metrics['dir'], "higher": True},
            {"name": "Demographic Parity", "b": b_metrics['dpd'], "a": m_metrics['dpd'], "higher": False},
            {"name": "Equalized Odds", "b": b_metrics['eo'], "a": m_metrics['eo'], "higher": False}
        ]:
            delta = row['a'] - row['b'] if row['higher'] else row['b'] - row['a']
            indicator = "(+)" if delta > 0 else "(-)"
            comp_data.append([
                row['name'], 
                f"{row['b']:.3f}", 
                f"{row['a']:.3f}", 
                f"{indicator} {abs(delta):.3f}"
            ])
        
        ct = Table(comp_data, colWidths=[2*inch, 1.2*inch, 1.2*inch, 1.2*inch])
        ct.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#00E5A0")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey)
        ]))
        elements.append(ct)
        elements.append(Spacer(1, 0.3 * inch))
        
        if 'mitigation_trace' in data and data['mitigation_trace']:
            elements.append(Paragraph("Mitigation Narrative", header_style))
            m_trace_text = data.get('mitigation_trace') or ""
            elements.append(Paragraph(m_trace_text.replace('\n', '<br/>'), body_style))

        # Implementation Code Section (Wrapped in Table for background)
        elements.append(Spacer(1, 0.4 * inch))
        elements.append(Paragraph("Production Implementation Code", header_style))
        code_text = f"""# Aegis One: Integration Code
from fairlearn.preprocessing import Reweighing
mitigator = Reweighing(prot_attr="{data['protected_attr']}")
weights = mitigator.fit_transform(X, y)
model.fit(X, y, sample_weight=weights)"""
        
        code_table = Table([[Paragraph(code_text.replace('\n', '<br/>'), code_style)]], colWidths=[6*inch])
        code_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#050810")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#00F0FF")),
            ('LEFTPADDING', (0, 0), (-1, -1), 15),
            ('RIGHTPADDING', (0, 0), (-1, -1), 15),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ]))
        elements.append(code_table)
            
    # Footer
    elements.append(Spacer(1, 0.5 * inch))
    elements.append(Paragraph("--- End of Fairness Audit Report ---", styles['Italic']))
    elements.append(Paragraph(f"Generated by Aegis One AI Governance Platform - {data['protected_attr']} Audit", ParagraphStyle('Footer', parent=styles['Italic'], fontSize=8, textColor=colors.grey)))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer
