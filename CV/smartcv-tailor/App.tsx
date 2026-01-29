import React, { useState, useRef, useEffect } from 'react';
import ResumePaper from './components/ResumePaper';
import { Spinner } from './components/Spinner';
import { INITIAL_RESUME } from './constants';
import { ResumeData, HistoryItem } from './types';
import { tailorResume } from './services/geminiService';

export default function App() {
  const [jobDescription, setJobDescription] = useState('');
  const [resumeData, setResumeData] = useState<ResumeData>(INITIAL_RESUME);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // History State with Persistence
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('cvHistory');
      return saved ? JSON.parse(saved) : [{
        id: 'original',
        timestamp: Date.now(),
        data: INITIAL_RESUME,
        label: 'Original Resume',
        jobDescription: ''
      }];
    } catch (e) {
      console.error("Failed to load history from storage", e);
      return [{
        id: 'original',
        timestamp: Date.now(),
        data: INITIAL_RESUME,
        label: 'Original Resume',
        jobDescription: ''
      }];
    }
  });
  
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>('original');

  // Persist history changes
  useEffect(() => {
    localStorage.setItem('cvHistory', JSON.stringify(history));
  }, [history]);

  // Responsive scaling for the preview
  useEffect(() => {
    const handleResize = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.offsetWidth;
        // A4 width in pixels at 96 DPI is approx 794px.
        // We add some padding buffer.
        const a4Width = 794; 
        const newScale = Math.min(1, (containerWidth - 48) / a4Width); // 48px is padding
        setScale(Math.max(0.4, newScale));
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTailorResume = async () => {
    if (!jobDescription.trim()) {
      setError("Please paste a Job Description first.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const tailoredData = await tailorResume(resumeData, jobDescription);
      
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        data: tailoredData,
        label: `Tailored Version ${history.length}`,
        jobDescription: jobDescription
      };

      setHistory(prev => [newHistoryItem, ...prev]);
      setSelectedHistoryId(newHistoryItem.id);
      setResumeData(tailoredData);
    } catch (err) {
      setError("Failed to generate resume. Please check your API key and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleHistorySelect = (item: HistoryItem) => {
    setResumeData(item.data);
    setJobDescription(item.jobDescription);
    setSelectedHistoryId(item.id);
    setError(null);
  };

  const handlePrint = () => {
    const previousTitle = document.title;

    try {
      // Generate default filename: LastNameFirstNames_CV
      const name = resumeData.personalInfo.name;
      if (name && name.trim()) {
        const parts = name.trim().split(/\s+/);
        const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        
        let fileNameBase = "";
        
        if (parts.length === 1) {
          fileNameBase = capitalize(parts[0]);
        } else {
          // Put last name first
          const lastName = capitalize(parts[parts.length - 1]);
          const firstNames = parts.slice(0, parts.length - 1).map(capitalize).join('');
          fileNameBase = `${lastName}${firstNames}`;
        }
        
        // Ensure strictly alphanumeric (plus underscore) for filename safety
        fileNameBase = fileNameBase.replace(/[^a-zA-Z0-9]/g, '');
        document.title = `${fileNameBase}_CV`;
      }
    } catch (e) {
      console.error("Error formatting filename", e);
    }

    window.print();
    
    // Restore original title
    document.title = previousTitle;
  };

  const handleReset = () => {
    // Revert to original
    const original = history.find(h => h.id === 'original');
    if (original) {
      handleHistorySelect(original);
    } else {
      // Fallback
      setResumeData(INITIAL_RESUME);
      setJobDescription('');
      setSelectedHistoryId('original');
    }
    setError(null);
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all history? This cannot be undone.")) {
      const original = history.find(h => h.id === 'original') || {
        id: 'original',
        timestamp: Date.now(),
        data: INITIAL_RESUME,
        label: 'Original Resume',
        jobDescription: ''
      };
      setHistory([original]);
      handleHistorySelect(original);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden print:bg-white print:h-auto print:overflow-visible">
      
      {/* Navigation / Header - Hidden on Print */}
      <nav className="bg-slate-850 text-white p-4 shadow-md print:hidden flex-shrink-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h1 className="text-xl font-bold tracking-tight">SmartCV Tailor</h1>
          </div>
          <div>
            <button 
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Save as PDF
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden relative print:block print:overflow-visible print:h-auto">
        
        {/* Left Panel: Input & History - Hidden on Print */}
        <div className="w-1/3 min-w-[350px] bg-white border-r border-gray-200 flex flex-col shadow-xl z-20 print:hidden">
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-6 space-y-6">
              
              <div>
                <label htmlFor="jd" className="block text-sm font-semibold text-gray-700 mb-2">
                  Job Description
                </label>
                <div className="relative">
                  <textarea
                    id="jd"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the Job Description here..."
                    className="w-full h-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm leading-relaxed shadow-sm transition-all"
                  />
                  {jobDescription && (
                     <button 
                       onClick={() => setJobDescription('')}
                       className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm border border-gray-100"
                       title="Clear text"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                         <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                       </svg>
                     </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleTailorResume}
                  disabled={isGenerating || !jobDescription.trim()}
                  className={`flex-1 flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all
                    ${isGenerating || !jobDescription.trim() 
                      ? 'bg-blue-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                  {isGenerating ? (
                    <>
                      <Spinner />
                      Tailoring...
                    </>
                  ) : (
                    'Tailor My Resume'
                  )}
                </button>
                
                <button
                  onClick={handleReset}
                  className="px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Reset
                </button>
              </div>

              {/* History Section */}
              <div className="pt-6 border-t border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Version History
                  </h3>
                  {history.length > 1 && (
                    <button 
                      onClick={clearHistory}
                      className="text-xs text-red-500 hover:text-red-700 underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                
                <div className="space-y-3">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleHistorySelect(item)}
                      className={`w-full text-left p-3 rounded-lg border transition-all relative group ${
                        selectedHistoryId === item.id 
                          ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 z-10' 
                          : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-semibold ${selectedHistoryId === item.id ? 'text-blue-700' : 'text-gray-900'}`}>
                          {item.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      {item.jobDescription ? (
                         <p className="text-xs text-gray-500 line-clamp-2">
                           {item.jobDescription}
                         </p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">
                          Base resume version
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0">
             <div className="text-xs text-gray-500 text-center">
               <p>Powered by Google Gemini 2.5 Flash</p>
               <p className="mt-1">Use Browser Print (Ctrl+P) to save as PDF</p>
             </div>
          </div>
        </div>

        {/* Right Panel: Preview */}
        <div 
          ref={previewContainerRef}
          className="flex-1 bg-gray-200/50 overflow-y-auto p-8 flex justify-center items-start print:p-0 print:bg-white print:overflow-visible print:block"
        >
          {/* Changed print:absolute to print:static to fix potential multipage issues */}
          <div className="relative print:w-full print:h-auto print:static">
             <ResumePaper data={resumeData} scale={scale} />
          </div>
        </div>

      </main>
    </div>
  );
}