from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
import os
from dotenv import load_dotenv

# Load environment variables for local development only
if "K_SERVICE" not in os.environ:
    load_dotenv()

from bias_engine import compute_metrics, apply_reweighing
from gemini_service import generate_bias_explanation, generate_mitigation_summary
from report_generator import generate_pdf_report
from fastapi.responses import StreamingResponse

app = FastAPI(title="Aegis One API", description="AI Bias Detection API")

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev MVP
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store session data in memory for MVP
sessions = {}

@app.post("/api/analyze")
async def analyze_bias(
    file: UploadFile = File(...),
    protected_attr: str = Form(...),
    target_col: str = Form(...),
    privileged_group: str = Form(...)
):
    try:
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Ensure standard numpy types to avoid serialization and compatibility issues
        # with Fairlearn/Scikit-learn that don't yet support all Pandas extension dtypes.
        for col in df.columns:
            if not pd.api.types.is_numeric_dtype(df[col]):
                # Convert to standard Python strings, preserving NaNs as None
                df[col] = df[col].map(lambda x: str(x) if pd.notna(x) else None)
        
        
        
        import uuid
        session_id = str(uuid.uuid4())
        sessions[session_id] = {
        
            "df": df,
            "protected_attr": protected_attr,
            "target_col": target_col,
            "privileged_group": privileged_group
        }
        
        # Compute metrics (handle intersectional list)
        protected_list = protected_attr.split(",") if "," in protected_attr else protected_attr
        metrics = compute_metrics(df, protected_list, target_col, privileged_group)
        
        # Get Gemini Explanation
        explanation = generate_bias_explanation(metrics, protected_attr, privileged_group)
        
        # Update session with results
        sessions[session_id].update({
            "metrics": metrics,
            "gemini_trace": explanation
        })
        
        return {
            "session_id": session_id,
            "metrics": metrics,
            "gemini_trace": explanation
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/mitigate")
async def mitigate_bias(
    session_id: str = Form(...),
    technique: str = Form(...)
):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = sessions[session_id]
    df = session["df"]
    protected_attr = session["protected_attr"]
    target_col = session["target_col"]
    privileged_group = session["privileged_group"]
    
    try:
        protected_list = protected_attr.split(",") if "," in protected_attr else protected_attr
        
        # Get baseline metrics
        before_metrics = compute_metrics(df, protected_list, target_col, privileged_group)
        
        # Apply mitigation
        if technique == "reweighing":
            after_metrics = apply_reweighing(df, protected_list, target_col, privileged_group)
        else:
            # Fallback to reweighing for demo
            after_metrics = apply_reweighing(df, protected_attr, target_col, privileged_group)
            
        # Get Gemini Summary
        summary = generate_mitigation_summary(before_metrics, after_metrics, technique)
        
        # Update session with mitigation results
        sessions[session_id].update({
            "mitigation_metrics": after_metrics,
            "mitigation_trace": summary,
            "technique": technique
        })
        
        return {
            "before": before_metrics,
            "after": after_metrics,
            "gemini_trace": summary
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/generate-report")
async def generate_report(session_id: str = Form(...)):
    print(f"DEBUG: Generating report for session: {session_id}")
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = sessions[session_id]
    
    try:
        # Prepare data for report generator
        report_data = {
            'protected_attr': session.get('protected_attr', 'Unknown'),
            'target_col': session.get('target_col', 'Unknown'),
            'privileged_group': session.get('privileged_group', 'Unknown'),
            'baseline_metrics': session.get('metrics'),
            'baseline_trace': session.get('gemini_trace'),
            'mitigated_metrics': session.get('mitigation_metrics'),
            'mitigation_trace': session.get('mitigation_trace'),
            'technique': session.get('technique')
        }
        
        if not report_data['baseline_metrics']:
            raise HTTPException(status_code=400, detail="No analysis results found in session")
            
        print("DEBUG: Calling generate_pdf_report")
        pdf_buffer = generate_pdf_report(report_data)
        print("DEBUG: PDF generated successfully")
        
        from fastapi import Response
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=Aegis_One_Audit_Report.pdf"}
        )
    except Exception as e:
        print(f"ERROR generating report: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF Generation Error: {str(e)}")



@app.post("/api/detect-config")
async def detect_config(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Take a small sample for Gemini to analyze
        sample_json = df.head(10).to_json(orient='records')
        
        from gemini_service import suggest_fairness_config
        suggestion = suggest_fairness_config(sample_json)
        
        # Verify columns exist in df
        cols = [c for c in df.columns.tolist() if c.lower() != 'id']
        all_cols = df.columns.tolist()
        
        # Smart Heuristic Fallback if Gemini fails
        likely_protected = ["gender", "race", "ethnicity", "age", "group", "sex"]
        likely_target = ["hired", "promoted", "outcome", "target", "approved", "recidivism", "score"]
        
        prot_fallback = next((c for c in all_cols if c.lower() in likely_protected), all_cols[0])
        target_fallback = next((c for c in all_cols if c.lower() in likely_target), all_cols[-1])

        final_suggestion = {
            "protected_attr": suggestion.get("protected_attr") if suggestion.get("protected_attr") in all_cols else prot_fallback,
            "target_col": suggestion.get("target_col") if suggestion.get("target_col") in all_cols else target_fallback,
            "privileged_group": suggestion.get("privileged_group")
        }
        
        return final_suggestion
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
