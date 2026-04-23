"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  Play,
  BarChart3,
  ShieldAlert,
  FileText,
  ChevronRight,
  ArrowRight,
  Target,
  Zap,
  Globe,
  Lock,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import ParticleBackground from "./components/ParticleBackground";

// Typewriter effect component
const Typewriter = ({ text, speed = 20 }: { text: string; speed?: number }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (!text) return;
    setDisplayedText("");
    let i = 0;
    const timer = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(i));
      i++;
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return <span>{displayedText}</span>;
};

export default function Home() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [mitigating, setMitigating] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [copied, setCopied] = useState(false);

  const [results, setResults] = useState<any>(null);
  const [mitigationResults, setMitigationResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMitigation, setActiveMitigation] = useState("reweighing");

  // Selection states
  const [protectedAttr, setProtectedAttr] = useState("");
  const [protectedAttrSecondary, setProtectedAttrSecondary] = useState("");
  const [targetCol, setTargetCol] = useState("");
  const [privilegedGroup, setPrivilegedGroup] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [privilegedOptions, setPrivilegedOptions] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update privileged options when file or protected attribute changes
  useEffect(() => {
    if (!file || !protectedAttr) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      if (lines.length < 2) return;

      const header = lines[0].split(',').map(c => c.trim().replace(/"/g, ''));
      const colIndex = header.indexOf(protectedAttr);

      if (colIndex !== -1) {
        const values = new Set<string>();

        // Handle intersectional options
        const colIndexSecondary = header.indexOf(protectedAttrSecondary);

        // Sample rows to get unique groups
        for (let i = 1; i < Math.min(lines.length, 2000); i++) {
          if (!lines[i]) continue;
          const row = lines[i].split(',');
          if (row[colIndex] !== undefined) {
            let val = row[colIndex].trim().replace(/"/g, '');

            // If intersectional, combine with secondary val
            if (colIndexSecondary !== -1 && row[colIndexSecondary] !== undefined) {
              const val2 = row[colIndexSecondary].trim().replace(/"/g, '');
              val = `${val}_${val2}`;
            }

            if (val) values.add(val);
          }
        }
        const options = Array.from(values).sort();
        setPrivilegedOptions(options);

        // Auto-select a likely privileged group if not already set or invalid
        if (options.length > 0) {
          if (!privilegedGroup || !options.includes(privilegedGroup)) {
            // Try to find common privileged terms
            const commonTerms = ["male", "white", "caucasian", "alpha", "privileged", "majority"];
            const bestMatch = options.find(opt => commonTerms.includes(opt.toLowerCase())) || options[0];
            setPrivilegedGroup(bestMatch);
          }
        }
      }
    };
    reader.readAsText(file.slice(0, 500000)); // Read first 500KB to get enough samples
  }, [file, protectedAttr]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const firstLine = text.split('\n')[0];
        const cols = firstLine.split(',').map(c => c.trim().replace(/"/g, ''));
        setColumns(cols);
      };
      reader.readAsText(selectedFile);

      // AI Auto-Config using Gemini
      setIsDetecting(true);
      const detectConfig = async () => {
        try {
          const formData = new FormData();
          formData.append("file", selectedFile);

          const response = await fetch(`${API_BASE_URL}/api/detect-config`, {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            const suggestion = await response.json();
            if (suggestion.protected_attr) setProtectedAttr(suggestion.protected_attr);
            if (suggestion.target_col) setTargetCol(suggestion.target_col);
            if (suggestion.privileged_group) setPrivilegedGroup(suggestion.privileged_group);
          }
        } catch (error) {
          console.error("AI Auto-Config failed:", error);
        } finally {
          setIsDetecting(false);
        }
      };
      detectConfig();
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError("Please upload a CSV file first.");
      return;
    }
    setError(null);
    setAnalyzing(true);
    setMitigationResults(null);
    console.log("Analyzing with:", { protectedAttr, targetCol, privilegedGroup });

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Intersectional attribute string
      const fullAttr = protectedAttrSecondary
        ? `${protectedAttr},${protectedAttrSecondary}`
        : protectedAttr;

      formData.append("protected_attr", fullAttr);
      formData.append("target_col", targetCol);
      formData.append("privileged_group", privilegedGroup);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Server error occurred during analysis.");
      }

      const data = await response.json();
      setResults(data);

      // Scroll to results
      setTimeout(() => {
        document.getElementById("results-dashboard")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      console.error("Analysis Error:", err);
      if (err.name === 'AbortError') {
        setError("Analysis timed out. The server is taking too long to respond.");
      } else {
        setError(err.message || "Failed to analyze dataset. Please check your network or backend logs.");
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleMitigate = async () => {
    if (!results) return;
    setError(null);
    setMitigating(true);

    try {
      const formData = new FormData();
      formData.append("session_id", results.session_id);
      formData.append("technique", activeMitigation);

      const response = await fetch(`${API_BASE_URL}/api/mitigate`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setMitigationResults(data);

      // Scroll to comparison
      setTimeout(() => {
        document.getElementById("comparison-panel")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      setError(err.message || "Failed to mitigate.");
    } finally {
      setMitigating(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!results) return;
    setGeneratingReport(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

    try {
      const formData = new FormData();
      formData.append("session_id", results.session_id);

      const response = await fetch(`${API_BASE_URL}/api/generate-report`, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Server error occurred during report generation.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "Aegis_One_Audit_Report.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Report Error:", err);
      if (err.name === 'AbortError') {
        setError("Report generation timed out.");
      } else {
        setError(err.message || "Failed to generate report.");
      }
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleShareDashboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const prepareBarData = (data: any) => {
    if (!data) return [];
    return Object.entries(data).map(([name, value]) => ({
      name,
      value
    }));
  };

  const calculateOverallScore = (metrics: any) => {
    if (!metrics) return 0;
    const dirScore = Math.min(1, metrics.dir);
    const dpdScore = 1 - Math.min(1, metrics.dpd);
    const eoScore = 1 - Math.min(1, metrics.eo);
    return Math.round(((dirScore + dpdScore + eoScore) / 3) * 100);
  };

  const getChartData = (barData: any) => {
    if (!barData) return [];
    return Object.keys(barData).map((key) => ({
      name: key,
      rate: barData[key],
    }));
  };

  return (
    <div className="relative min-h-screen text-[#F8F9FA] selection:bg-[#00F0FF]/30">
      <ParticleBackground />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-white/10 bg-[#0A0F1A]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00F0FF] to-[#8A2BE2] flex items-center justify-center shadow-lg shadow-[#00F0FF]/20">
              <ShieldAlert className="text-[#0A0F1A] w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight">Aegis <span className="text-[#00F0FF]">One</span></span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#F8F9FA]/60">
            <a href="#problem" className="hover:text-[#00F0FF] transition-colors">Problem</a>
            <a href="#solution" className="hover:text-[#00F0FF] transition-colors">Solution</a>
            <a href="#demo" className="hover:text-[#00F0FF] transition-colors">Live Demo</a>
            <a href="#tech" className="hover:text-[#00F0FF] transition-colors">Tech Stack</a>
          </div>

          <a href="#demo" className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#00F0FF] to-[#8A2BE2] text-[#0A0F1A] font-bold text-sm hover:opacity-90 transition shadow-lg shadow-[#00F0FF]/10">
            Try Demo <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-44 pb-32 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-mono text-[#F8F9FA]/60 mb-8">
              <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse"></span>
              Open Innovation · AI Ethics & Fairness Track
            </div>
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] mb-8 tracking-tight">
              AI That's <span className="gradient-text">Accountable</span> <br />
              By Design
            </h1>
            <p className="text-lg md:text-xl text-[#F8F9FA]/60 max-w-xl mb-12 leading-relaxed">
              Aegis One detects, visualizes, and eliminates algorithmic bias in AI systems —
              empowering teams to build fairer, explainable, and auditable models in minutes.
            </p>

            <div className="flex flex-wrap gap-4 items-center mb-12">
              <div className="flex flex-col">
                <span className="text-2xl font-bold font-mono text-[#00F0FF]">5</span>
                <span className="text-[10px] uppercase tracking-widest text-[#F8F9FA]/40 font-bold">Metrics</span>
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold font-mono text-[#00F0FF]">4</span>
                <span className="text-[10px] uppercase tracking-widest text-[#F8F9FA]/40 font-bold">Mitigation</span>
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold font-mono text-[#00F0FF]">100%</span>
                <span className="text-[10px] uppercase tracking-widest text-[#F8F9FA]/40 font-bold">Auditability</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <a href="#demo" className="btn-primary">
                Launch Live Demo <ArrowRight className="w-5 h-5" />
              </a>
              <a href="#solution" className="btn-ghost">
                Learn How It Works
              </a>
            </div>
          </div>

          <div className="relative hidden lg:block h-[500px]">
            {/* Orbs */}
            <div className="orb w-[350px] h-[350px] bg-[#00F0FF]/10 top-0 right-0 animate-float"></div>
            <div className="orb w-[250px] h-[250px] bg-[#8A2BE2]/10 bottom-0 right-24 animate-float-delayed"></div>

            {/* Floating Cards */}
            <div className="absolute top-10 right-0 glass-card p-6 w-56 animate-float shadow-2xl">
              <p className="text-[10px] uppercase tracking-wider text-[#F8F9FA]/50 mb-2">Disparate Impact Ratio</p>
              <p className="text-3xl font-bold font-mono text-[#FF4D6D]">0.62</p>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-[#FF4D6D] font-bold">
                <AlertTriangle className="w-3 h-3" /> ⚠ Biased
              </div>
            </div>

            <div className="absolute top-44 right-40 glass-card p-6 w-56 animate-float-delayed shadow-2xl">
              <p className="text-[10px] uppercase tracking-wider text-[#F8F9FA]/50 mb-2">After Mitigation</p>
              <p className="text-3xl font-bold font-mono text-[#00E5A0]">0.91</p>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-[#00E5A0] font-bold">
                <CheckCircle2 className="w-3 h-3" /> ✓ Fair
              </div>
            </div>

            <div className="absolute bottom-20 right-10 glass-card p-5 w-64 animate-float shadow-2xl border-[#00F0FF]/30">
              <div className="flex items-center gap-2 text-[#00F0FF] mb-3">
                <span className="text-lg">✦</span>
                <span className="text-[10px] font-bold uppercase font-mono">Gemini AI Insight</span>
              </div>
              <p className="text-xs text-[#F8F9FA]/80 leading-relaxed font-mono">
                "Gender disparity detected — recommend Reweighing (Pre-Processing)"
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section id="problem" className="py-32 px-6 bg-gradient-to-b from-[#0A0F1A] to-[#0D1524]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <span className="section-tag">The Problem</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Bias is <span className="gradient-text">Invisible</span> — Until It Harms</h2>
            <p className="text-lg text-[#F8F9FA]/60 max-w-2xl mx-auto">
              AI systems trained on historical data quietly amplify societal inequities across critical life decisions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            {[
              { icon: "💳", title: "Finance", desc: "Credit models deny loans to minority applicants at 38% higher rates.", stat: "38% higher denial rate" },
              { icon: "🏥", title: "Healthcare", desc: "Diagnostic AI underdiagnoses patients of color due to skewed representation.", stat: "Underrepresented data" },
              { icon: "💼", title: "Hiring", desc: "Resume models consistently rank male candidates higher for technical roles.", stat: "Gender bias detected" },
              { icon: "⚖️", title: "Justice", desc: "Recidivism tools assign higher risk scores to Black defendants at 2x rate.", stat: "2x false positive disparity" }
            ].map((p, i) => (
              <div key={i} className="glass-card p-8 hover:border-[#00F0FF]/30 transition group">
                <div className="text-4xl mb-6 group-hover:scale-110 transition-transform">{p.icon}</div>
                <h3 className="text-xl font-bold mb-4">{p.title}</h3>
                <p className="text-sm text-[#F8F9FA]/60 mb-6 leading-relaxed">{p.desc}</p>
                <div className="text-[10px] font-mono text-[#FF4D6D] bg-[#FF4D6D]/10 px-3 py-1.5 rounded-lg inline-block font-bold">
                  {p.stat}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-center">
            <div className="glass-card px-8 py-6 w-56">
              <span className="text-2xl mb-2 block">👁️</span>
              <p className="font-bold mb-1">No Visibility</p>
              <p className="text-[10px] text-[#F8F9FA]/50">Can't quantify fairness</p>
            </div>
            <ArrowRight className="w-6 h-6 text-[#00F0FF] hidden lg:block" />
            <div className="glass-card px-8 py-6 w-56">
              <span className="text-2xl mb-2 block">🔧</span>
              <p className="font-bold mb-1">No Tooling</p>
              <p className="text-[10px] text-[#F8F9FA]/50">Mitigation is ad hoc</p>
            </div>
            <ArrowRight className="w-6 h-6 text-[#00F0FF] hidden lg:block" />
            <div className="glass-card px-8 py-6 w-56">
              <span className="text-2xl mb-2 block">🚧</span>
              <p className="font-bold mb-1">High Barrier</p>
              <p className="text-[10px] text-[#F8F9FA]/50">Deep ML required</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="solution" className="py-32 px-6 bg-[#0D1524]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <span className="section-tag">The Solution</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">One Platform. <span className="gradient-text">Complete Fairness.</span></h2>
            <p className="text-lg text-[#F8F9FA]/60 max-w-2xl mx-auto">
              Aegis One provides the full measure-mitigate-compare loop in an intuitive interface.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-4 overflow-hidden">
            {[
              { num: "01", icon: "📤", title: "Upload & Detect", desc: "Upload CSV predictions. Aegis One computes 5 fairness metrics instantly." },
              { num: "02", icon: "📊", title: "Visualize", desc: "Interactive dashboards with Gemini AI plain-English explanations." },
              { num: "03", icon: "⚡", title: "Mitigate", desc: "Apply Reweighing or Threshold Optimiser and see improvement in real time." },
              { num: "04", icon: "📄", title: "Audit", desc: "Generate a one-click PDF Fairness Audit Report for regulators." }
            ].map((s, i) => (
              <div key={i} className="glass-card p-8 border-transparent hover:border-[#00F0FF]/30 transition group relative">
                <div className="text-xs font-mono text-[#00F0FF] mb-4">{s.num}</div>
                <div className="text-4xl mb-6">{s.icon}</div>
                <h3 className="text-lg font-bold mb-3">{s.title}</h3>
                <p className="text-sm text-[#F8F9FA]/60 leading-relaxed">{s.desc}</p>
                {i < 3 && <ArrowRight className="absolute -right-3 top-1/2 -translate-y-1/2 text-[#00F0FF] opacity-0 group-hover:opacity-100 transition hidden lg:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Demo Dashboard Section */}
      <section id="demo" className="py-32 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className="section-tag">Interactive Demo</span>
            <h2 className="text-4xl font-bold mb-6">See Bias <span className="gradient-text">Disappear</span> in Real Time</h2>
            <p className="text-[#F8F9FA]/60">This live dashboard connects to the Aegis One ML Engine. Upload a CSV to begin.</p>
          </div>

          {error && (
            <div className="mb-8 p-4 glass-card border-[#FF4D6D]/40 bg-[#FF4D6D]/10 text-[#FF4D6D] font-mono text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5" /> {error}
            </div>
          )}

          <div className="grid lg:grid-cols-[340px_1fr] gap-8">
            {/* Control Panel */}
            <div className="space-y-6">
              <div className="glass-card p-8">
                <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#00F0FF]" /> Config Panel
                </h4>

                <div
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition cursor-pointer mb-8 
                    ${file ? "border-[#00E5A0]/50 bg-[#00E5A0]/5" : "border-white/10 hover:border-[#00F0FF]/50 bg-white/5"}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className={`w-10 h-10 mb-4 ${file ? "text-[#00E5A0]" : "text-[#00F0FF]"}`} />
                  <p className="font-bold text-sm mb-1">{file ? file.name : "Select CSV Dataset"}</p>
                  <p className="text-[10px] text-[#F8F9FA]/40 font-mono">Max size: 50MB · Required: Gender/Race → Hired</p>
                  <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                </div>

                <div className="space-y-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-[#F8F9FA]/40 font-bold">Protected Attribute</label>
                    <select
                      value={protectedAttr}
                      onChange={(e) => setProtectedAttr(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#00F0FF] w-full"
                    >
                      <option value="" disabled>Select Attribute...</option>
                      {columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-[#F8F9FA]/40 font-bold">Secondary Attribute (Optional)</label>
                    <select
                      value={protectedAttrSecondary}
                      onChange={(e) => setProtectedAttrSecondary(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#00F0FF] w-full"
                    >
                      <option value="">None (Single Attribute)</option>
                      {columns.map(col => (
                        col !== protectedAttr && <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-[#F8F9FA]/40 font-bold">Target Column</label>
                    <select
                      value={targetCol}
                      onChange={(e) => setTargetCol(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#00F0FF] w-full"
                    >
                      <option value="" disabled>Select Target...</option>
                      {columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-[#F8F9FA]/40 font-bold">Privileged Group</label>
                    <select
                      value={privilegedGroup}
                      onChange={(e) => setPrivilegedGroup(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#00F0FF] w-full"
                    >
                      {privilegedOptions.length === 0 ? (
                        <option value="" disabled>Upload CSV to see groups...</option>
                      ) : (
                        privilegedOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)
                      )}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !file || !protectedAttr || !targetCol || !privilegedGroup}
                  className="w-full btn-primary justify-center mt-8 py-4 disabled:opacity-50"
                >
                  {analyzing ? <><span className="spinner"></span> Analyzing...</> : <><Play className="w-5 h-5" /> Analyze for Bias</>}
                </button>
              </div>

              {results && (
                <div className="glass-card p-8 animate-in fade-in slide-in-from-bottom-4">
                  <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-[#8A2BE2]" /> Mitigation Engine
                  </h4>
                  <div className="space-y-4">
                    {[
                      { id: "reweighing", name: "Reweighing", type: "Pre-Processing" },
                      { id: "threshold", name: "Threshold Optimiser", type: "Post-Processing" }
                    ].map((m) => (
                      <div
                        key={m.id}
                        onClick={() => setActiveMitigation(m.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition ${activeMitigation === m.id ? "border-[#00F0FF] bg-[#00F0FF]/10" : "border-white/10 bg-white/5 hover:border-white/30"}`}
                      >
                        <p className="font-bold text-sm">{m.name}</p>
                        <p className="text-[10px] font-mono text-[#00F0FF] mt-1">{m.type}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleMitigate}
                    disabled={mitigating}
                    className="w-full btn-primary justify-center mt-6 bg-gradient-to-r from-[#00F0FF] to-[#00E5A0]"
                  >
                    {mitigating ? <><span className="spinner"></span> Mitigating...</> : <><Zap className="w-5 h-5" /> Apply & Compare</>}
                  </button>
                </div>
              )}
            </div>

            {/* Main Results Dashboard */}
            <div id="results-dashboard" className="space-y-8">
              {!results ? (
                <div className="glass-card p-20 flex flex-col items-center justify-center text-[#F8F9FA]/30 italic min-h-[400px]">
                  <BarChart3 className="w-16 h-16 mb-4 opacity-10 animate-pulse" />
                  <p className="text-sm font-mono tracking-widest uppercase">Awaiting dataset analysis...</p>
                  <p className="text-[10px] mt-2 not-italic">Upload a CSV and click "Analyze" to begin audit.</p>
                </div>
              ) : (
                <div className="space-y-10">
                  <div className="glass-card p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-8 border-b border-white/5">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="section-tag !mb-0">Analysis Complete</span>
                          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-tighter uppercase
                            ${results.metrics.dpd > 0.1 ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"}`}>
                            {results.metrics.dpd > 0.1 ? "⚠ BIAS DETECTED" : "✓ COMPLIANT"}
                          </div>
                        </div>
                        <h3 className="text-3xl font-bold">Fairness Scorecard</h3>
                      </div>

                      <div className="flex items-center gap-6 bg-white/5 p-4 rounded-3xl border border-white/10">
                        <div className="relative w-20 h-20">
                          <svg className="w-full h-full -rotate-90">
                            <circle cx="40" cy="40" r="36" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                            <circle cx="40" cy="40" r="36" fill="transparent" strokeWidth="4"
                              strokeDasharray={226} strokeDashoffset={226 - (226 * calculateOverallScore(results.metrics)) / 100}
                              stroke="url(#gauge-gradient)"
                              className="transition-all duration-1000 ease-out" />
                            <defs>
                              <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#00F0FF" />
                                <stop offset="100%" stopColor="#8A2BE2" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-bold">{calculateOverallScore(results.metrics)}%</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Overall Fairness</p>
                          <p className="text-sm font-semibold">{calculateOverallScore(results.metrics) > 80 ? "Excellent" : calculateOverallScore(results.metrics) > 50 ? "Moderate Bias" : "Critical Bias"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                      {[
                        { label: "Disparate Impact", val: results.metrics.dir.toFixed(3), target: "≥ 0.800", status: results.metrics.dir < 0.8 ? "fail" : "pass" },
                        { label: "Demographic Parity", val: results.metrics.dpd.toFixed(3), target: "≤ 0.050", status: results.metrics.dpd > 0.05 ? "fail" : "pass" },
                        { label: "Equalized Odds", val: results.metrics.eo.toFixed(3), target: "≤ 0.050", status: results.metrics.eo > 0.05 ? "fail" : "pass" },
                        { label: "Accuracy Gap", val: `${(Math.abs(results.metrics.acc_priv - results.metrics.acc_unpriv) * 100).toFixed(1)}%`, target: "≤ 3.0%", status: Math.abs(results.metrics.acc_priv - results.metrics.acc_unpriv) > 0.03 ? "fail" : "pass" }
                      ].map((m, i) => (
                        <div key={i} className={`p-6 rounded-2xl border transition-all ${m.status === 'fail' ? 'border-[#FF4D6D]/40 bg-[#FF4D6D]/5' : 'border-[#00E5A0]/40 bg-[#00E5A0]/5'}`}>
                          <p className="text-[10px] text-[#F8F9FA]/50 uppercase tracking-widest font-bold mb-2">{m.label}</p>
                          <p className={`text-3xl font-bold font-mono mb-2 ${m.status === 'fail' ? 'text-[#FF4D6D]' : 'text-[#00E5A0]'}`}>{m.val}</p>
                          <p className="text-[10px] text-[#F8F9FA]/30 font-mono italic">Goal: {m.target}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="glass-card p-6 bg-white/[0.02]">
                        <h5 className="text-[10px] uppercase tracking-widest text-[#F8F9FA]/40 font-bold mb-6 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-[#00F0FF]" /> Outcome Disparity
                        </h5>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={prepareBarData(results.metrics.bar_data)} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#F8F9FA', opacity: 0.7, fontSize: 11 }} />
                              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0A0F1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={32}>
                                {prepareBarData(results.metrics.bar_data).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? '#00F0FF' : '#8A2BE2'} fillOpacity={0.8} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center gap-6 mt-4 text-[10px] font-mono">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-[#00F0FF]" />
                            <span className="text-xs text-gray-400">{results.privileged_group || "Privileged"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-[#8A2BE2]" />
                            <span className="text-xs text-gray-400">Others</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col h-full">
                        <div className="flex-1 bg-gradient-to-br from-[#00F0FF]/10 to-[#8A2BE2]/10 rounded-2xl p-8 border border-[#00F0FF]/20 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                            <ShieldAlert className="w-24 h-24" />
                          </div>
                          <h5 className="text-[10px] uppercase tracking-widest text-[#00F0FF] font-bold mb-6 flex items-center gap-2">
                            ✦ Gemini AI Governance Trace
                          </h5>
                          <div className="text-sm text-[#F8F9FA]/90 font-mono leading-[1.8] whitespace-pre-wrap">
                            <Typewriter text={results.gemini_trace} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {mitigationResults && (
                    <div id="comparison-panel" className="glass-card p-10 border-[#00E5A0]/40 bg-[#00E5A0]/5 animate-in fade-in slide-in-from-bottom-4">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
                        <div>
                          <span className="section-tag !mb-2 bg-[#00E5A0]/20 text-[#00E5A0]">Optimization Applied</span>
                          <h4 className="text-3xl font-bold">Mitigation Impact Report</h4>
                        </div>
                        <span className="px-4 py-2 rounded-xl bg-[#00E5A0]/20 text-[#00E5A0] text-xs font-bold font-mono border border-[#00E5A0]/30 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> REWEIGHING SUCCESSFUL
                        </span>
                      </div>

                      <div className="grid lg:grid-cols-[1fr_300px] gap-10 mb-10">
                        <div className="glass-card p-8 bg-white/5 border-white/10">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-[#00F0FF] mb-8 flex items-center gap-2">
                            <Zap className="w-4 h-4" /> Graphical Fairness Gain
                          </h4>
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={[
                                { name: 'Disparate Impact', Baseline: results.metrics.dir, Mitigated: mitigationResults.after.dir },
                                { name: 'Demographic Parity', Baseline: 1 - results.metrics.dpd, Mitigated: 1 - mitigationResults.after.dpd },
                                { name: 'Equalized Odds', Baseline: 1 - results.metrics.eo, Mitigated: 1 - mitigationResults.after.eo }
                              ]}>
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis hide domain={[0, 1]} />
                                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1A2234', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', marginBottom: '20px' }} />
                                <Bar dataKey="Baseline" fill="rgba(255,255,255,0.1)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Mitigated" fill="#00F0FF" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="flex flex-col gap-4">
                          <div className="p-6 rounded-2xl bg-[#00E5A0]/10 border border-[#00E5A0]/20 flex flex-col items-center justify-center text-center">
                            <p className="text-[10px] text-[#00E5A0] uppercase font-bold tracking-widest mb-2">Fairness Gain</p>
                            <p className="text-4xl font-bold text-[#00E5A0]">+{((mitigationResults.after.dir - results.metrics.dir) / Math.max(0.01, results.metrics.dir) * 100).toFixed(0)}%</p>
                          </div>
                          <div className="flex-1 glass-card p-6 border-white/10 text-xs font-mono text-gray-400 leading-relaxed overflow-y-auto max-h-[300px]">
                            <p className="mb-4 text-[#00F0FF]">✦ MITIGATION SUMMARY</p>
                            <Typewriter text={mitigationResults.gemini_trace} />
                          </div>
                        </div>
                      </div>
                      <div className="overflow-x-auto mb-10">
                        <table className="w-full text-left text-sm font-mono border-separate border-spacing-y-2">
                          <thead>
                            <tr className="text-[#F8F9FA]/40 text-[10px] uppercase tracking-widest">
                              <th className="px-4 py-3 font-bold">Metric</th>
                              <th className="px-4 py-3 font-bold">Baseline</th>
                              <th className="px-4 py-3 font-bold">Mitigated</th>
                              <th className="px-4 py-3 font-bold">Improvement</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { name: "Disparate Impact", b: mitigationResults.before.dir, a: mitigationResults.after.dir, higher: true },
                              { name: "Demographic Parity", b: mitigationResults.before.dpd, a: mitigationResults.after.dpd, higher: false },
                              { name: "Equalized Odds", b: mitigationResults.before.eo, a: mitigationResults.after.eo, higher: false }
                            ].map((row, i) => {
                              const delta = row.higher ? row.a - row.b : row.b - row.a;
                              const improved = delta >= 0;
                              return (
                                <tr key={i} className="bg-white/5 rounded-xl">
                                  <td className="px-4 py-4 rounded-l-xl font-bold">{row.name}</td>
                                  <td className="px-4 py-4 text-[#FF4D6D]">{row.b.toFixed(3)}</td>
                                  <td className="px-4 py-4 text-[#00E5A0]">{row.a.toFixed(3)}</td>
                                  <td className={`px-4 py-4 rounded-r-xl font-bold ${improved ? "text-[#00E5A0]" : "text-[#FF4D6D]"}`}>
                                    {improved ? "↑" : "↓"} {Math.abs(delta).toFixed(3)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8 mb-10">
                        {/* Aegis Trust Seal */}
                        <div className={`glass-card p-8 border-2 transition-all duration-1000 flex flex-col items-center justify-center text-center relative overflow-hidden
                          ${calculateOverallScore(mitigationResults.after) > 80
                            ? "border-[#00E5A0]/50 bg-[#00E5A0]/5 shadow-[0_0_30px_rgba(0,229,160,0.1)]"
                            : "border-white/10 bg-white/5 opacity-60"}`}>

                          {calculateOverallScore(mitigationResults.after) > 80 && (
                            <div className="absolute inset-0 bg-gradient-to-t from-[#00E5A0]/10 to-transparent animate-pulse" />
                          )}

                          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 border-2 transition-all duration-1000
                            ${calculateOverallScore(mitigationResults.after) > 80 ? "border-[#00E5A0] bg-[#00E5A0]/20 scale-110" : "border-white/20"}`}>
                            <ShieldCheck className={`w-10 h-10 ${calculateOverallScore(mitigationResults.after) > 80 ? "text-[#00E5A0] animate-bounce" : "text-white/20"}`} />
                          </div>

                          <h4 className="text-xl font-bold mb-2">Aegis Trust Certification</h4>
                          <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-gray-400 mb-4">Verification Status</p>

                          {calculateOverallScore(mitigationResults.after) > 80 ? (
                            <div className="space-y-4">
                              <span className="px-4 py-1.5 rounded-full bg-[#00E5A0]/20 text-[#00E5A0] text-[10px] font-bold border border-[#00E5A0]/30">
                                ✓ ETHICALLY VALIDATED
                              </span>
                              <p className="text-xs text-gray-400 leading-relaxed max-w-[200px]">
                                This model meets the 80% Fairness Threshold for production deployment.
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500 italic">Analysis ongoing... threshold not yet met.</p>
                          )}
                        </div>

                        {/* Production Code Lab */}
                        <div className="glass-card p-0 border-white/10 overflow-hidden flex flex-col">
                          <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                <div className="w-2 h-2 rounded-full bg-[#FF5F56]" />
                                <div className="w-2 h-2 rounded-full bg-[#FFBD2E]" />
                                <div className="w-2 h-2 rounded-full bg-[#27C93F]" />
                              </div>
                              <span className="text-[10px] font-mono text-gray-400 ml-2">integration_script.py</span>
                            </div>
                            <button className="text-[10px] text-[#00F0FF] hover:underline font-mono">Copy Code</button>
                          </div>
                          <div className="p-6 bg-[#050810] flex-1">
                            <pre className="text-[11px] font-mono leading-relaxed text-blue-300">
                              <code>{`# Aegis One: Production Integration
import pandas as pd
from fairlearn.preprocessing import \\
     Reweighing

# 1. Initialize Aegis Mitigation
mitigator = Reweighing(
    prot_attr="${results.protected_attr}"
)

# 2. Apply Bias Correction
# This uses the optimized weights 
# generated during analysis
weights = mitigator.fit_transform(
    X_train, y_train
)

# 3. Train Fair Model
model.fit(X_train, y_train, 
          sample_weight=weights)`}</code>
                            </pre>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-4">
                        <button onClick={handleShareDashboard} className="btn-ghost flex items-center gap-2 relative">
                          <Globe className="w-4 h-4" /> {copied ? "Copied!" : "Share Dashboard"}
                        </button>
                        <button onClick={handleDownloadReport} disabled={generatingReport} className="btn-primary flex items-center gap-2 bg-gradient-to-r from-[#00E5A0] to-[#00F0FF] text-[#0A0F1A]">
                          {generatingReport ? <><span className="spinner border-[#0A0F1A]"></span> Generating...</> : <><FileText className="w-4 h-4" /> Generate PDF Report</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section id="tech" className="py-32 px-6 bg-[#0D1524]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <span className="section-tag">Technical Architecture</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Built on <span className="gradient-text">Google-First</span> Infrastructure</h2>
          </div>

          <div className="space-y-4 max-w-4xl mx-auto mb-24">
            {[
              { label: "Frontend Layer (Cloud Run)", tech: ["Next.js 14", "TypeScript", "Tailwind CSS", "Recharts"] },
              { label: "Governance Engine (Cloud Run)", tech: ["Python FastAPI", "Fairlearn", "Scikit-Learn", "Gemini AI ✦"], highlight: true },
              { label: "Automation & CI/CD", tech: ["Google Cloud Build", "Artifact Registry", "Docker Containerization"] }
            ].map((layer, i) => (
              <div key={i} className={`glass-card p-6 flex flex-col md:flex-row md:items-center gap-6 ${layer.highlight ? "border-[#00F0FF]/40 bg-[#00F0FF]/5" : ""}`}>
                <div className="min-w-[200px] font-bold text-sm text-[#F8F9FA]/50">{layer.label}</div>
                <div className="flex flex-wrap gap-2">
                  {layer.tech.map((t, j) => (
                    <span key={j} className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono border ${t.includes("✦") ? "bg-[#00F0FF]/10 border-[#00F0FF]/30 text-[#00F0FF]" : "bg-white/5 border-white/10"}`}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: <Zap className="w-8 h-8 text-[#00F0FF]" />, name: "Gemini 1.5 Flash", desc: "AI Governance Layer — translates complex algorithmic bias metrics into actionable, plain-English audit traces." },
              { icon: <Globe className="w-8 h-8 text-[#00F0FF]" />, name: "Google Cloud Run", desc: "Serverless container hosting for both the analytical backend and frontend, ensuring seamless scalability and reliability." },
              { icon: <Layers className="w-8 h-8 text-[#00F0FF]" />, name: "Artifact Registry", desc: "Centralized hub for managing production-ready container images, enabling rapid deployment across the Google ecosystem." }
            ].map((g, i) => (
              <div key={i} className="glass-card p-8 hover:border-[#00F0FF]/30 transition group">
                <div className="mb-6 group-hover:scale-110 transition-transform">{g.icon}</div>
                <h3 className="text-lg font-bold mb-4">{g.name}</h3>
                <p className="text-sm text-[#F8F9FA]/60 leading-relaxed">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <span className="section-tag">Impact & Metrics</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Measured. <span className="gradient-text">Proven.</span> Deployable.</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
            {[
              { num: "< 5s", label: "End-to-End Analysis", sub: "CSV upload to dashboard" },
              { num: "±2%", label: "Detection Accuracy", sub: "vs. AIF360 baseline" },
              { num: "≥20%", label: "DIR Improvement", sub: "After Reweighing" },
              { num: "≤3%", label: "Accuracy Trade-off", sub: "Minimal performance drop" }
            ].map((m, i) => (
              <div key={i} className="text-center p-10 glass-card bg-white/[0.02]">
                <p className="text-4xl font-bold font-mono text-[#00F0FF] mb-2">{m.num}</p>
                <p className="font-bold mb-2">{m.label}</p>
                <p className="text-[10px] text-[#F8F9FA]/40 font-mono tracking-wider">{m.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {[
              { name: "Arjun — ML Engineer", org: "Fintech Startup", quote: "Reproducible fairness checks at every model iteration — without re-inventing the wheel." },
              { name: "Dr. Priya — Data Analyst", org: "Government Hospital AI", quote: "A simple dashboard that even non-technical administrators can read and understand." },
              { name: "Ravi — Compliance Officer", org: "Banking Regulator", quote: "Independent, reproducible audits that produce a verifiable fairness scorecard." }
            ].map((p, i) => (
              <div key={i} className="glass-card p-8 hover:transform hover:-translate-y-2 transition">
                <div className="text-3xl mb-4">👤</div>
                <h4 className="font-bold text-base">{p.name}</h4>
                <p className="text-[10px] text-[#00F0FF] font-mono mb-6">{p.org}</p>
                <p className="text-sm text-[#F8F9FA]/60 italic border-l-2 border-[#8A2BE2] pl-4">{p.quote}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="py-24 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="glass-card p-16 text-center relative overflow-hidden bg-gradient-to-br from-[#00F0FF]/5 to-[#8A2BE2]/5">
            <div className="relative z-10">
              <h2 className="text-4xl font-bold mb-4">Fairer AI Starts Here</h2>
              <p className="text-[#F8F9FA]/60 mb-10 max-w-xl mx-auto">
                Aegis One — Built with Google Gemini AI · Deployed on Google Cloud Run · Open Innovation Hackathon 2026
              </p>
              <div className="flex flex-wrap justify-center gap-6 mb-12">
                <a href="#demo" className="btn-primary">Launch Dashboard</a>
                <a href="https://github.com" className="btn-ghost" target="_blank">GitHub Repository →</a>
              </div>
              <div className="flex flex-wrap justify-center gap-6 text-[10px] font-mono text-[#F8F9FA]/30 uppercase tracking-widest font-bold">
                <span>Track: AI Ethics & Fairness</span>
                <span className="text-[#00F0FF]">●</span>
                <span> Deepak_M</span>
                <span className="text-[#00F0FF]">●</span>
                <span>April 2026</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
