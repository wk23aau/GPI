import React from 'react';
import { ResumeData } from '../types';

interface ResumePaperProps {
  data: ResumeData;
  scale?: number;
}

const ResumePaper: React.FC<ResumePaperProps> = ({ data, scale = 1 }) => {
  return (
    <>
      <style>
        {`
          @media print {
            .resume-paper-container {
              transform: none !important;
              box-shadow: none !important;
              margin: 0 !important;
              width: 100% !important;
              height: auto !important;
              padding: 15mm !important; 
            }
            @page {
              size: auto;
              margin: 5mm 0mm;
            }
            body {
              margin: 0;
            }
          }
        `}
      </style>
      <div 
        className="resume-paper-container bg-white shadow-lg mx-auto print:mx-0 print:w-full"
        style={{
          width: '210mm', // A4 width
          minHeight: '297mm', // A4 height
          padding: '15mm', // Padding (approx 0.6in)
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          color: '#000000' // Ensure pure black for text
        }}
      >
        {/* Header */}
        <header className="text-center border-b-2 border-gray-300 pb-4 mb-4">
          <h1 className="text-3xl font-bold uppercase tracking-wider text-gray-800">{data.personalInfo.name}</h1>
          <h2 className="text-xl font-semibold text-gray-600 mt-1">{data.personalInfo.title}</h2>
          <div className="text-sm mt-2 text-gray-700 flex flex-wrap justify-center gap-2">
            <span>{data.personalInfo.address}</span>
            <span className="hidden sm:inline">|</span>
            <span>{data.personalInfo.phone}</span>
            <span className="hidden sm:inline">|</span>
            <a href={`mailto:${data.personalInfo.email}`} className="text-blue-800 underline print:no-underline print:text-black">
              {data.personalInfo.email}
            </a>
          </div>
        </header>

        {/* Summary */}
        <section className="mb-4">
          <h3 className="text-sm font-bold uppercase border-b border-gray-300 mb-2 tracking-wide text-gray-700">Summary</h3>
          <p className="text-sm leading-relaxed text-gray-800 text-justify">
            {data.summary}
          </p>
        </section>

        {/* Key Skills */}
        <section className="mb-4">
          <h3 className="text-sm font-bold uppercase border-b border-gray-300 mb-2 tracking-wide text-gray-700">Key Skills</h3>
          <ul className="text-sm list-none space-y-1">
            {data.skills.map((skillGroup, idx) => (
              <li key={idx} className="flex">
                <span className="font-semibold w-32 flex-shrink-0 text-gray-800">{skillGroup.category}:</span>
                <span className="text-gray-800">{skillGroup.items.join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Experience */}
        <section className="mb-4">
          <h3 className="text-sm font-bold uppercase border-b border-gray-300 mb-2 tracking-wide text-gray-700">Professional Experience</h3>
          <div className="space-y-4">
            {data.experience.map((exp, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-baseline">
                  <h4 className="font-bold text-base text-gray-900">
                    {exp.company} <span className="font-normal text-gray-600">| {exp.location}</span>
                  </h4>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold underline text-sm text-gray-800">{exp.role}</span>
                  <span className="text-sm text-gray-600 italic">{exp.dates}</span>
                </div>
                {exp.description && (
                  <p className="text-sm italic mb-1 text-gray-700">{exp.description}</p>
                )}
                <ul className="list-disc list-outside ml-4 text-sm space-y-1 text-gray-800">
                  {exp.bullets.map((bullet, bIdx) => {
                    const [boldPart, rest] = bullet.includes(':') 
                      ? bullet.split(/:(.+)/) 
                      : [null, bullet];
                    
                    return (
                      <li key={bIdx}>
                        {boldPart ? (
                          <>
                            <span className="font-semibold">{boldPart}:</span>{rest}
                          </>
                        ) : (
                          bullet
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Education */}
        <section className="mb-4">
          <h3 className="text-sm font-bold uppercase border-b border-gray-300 mb-2 tracking-wide text-gray-700">Education</h3>
          <div className="space-y-3">
            {data.education.map((edu, idx) => (
              <div key={idx}>
                <div className="font-bold text-sm text-gray-900">{edu.degree}</div>
                <div className="flex justify-between text-sm text-gray-700">
                  <span>{edu.institution} | {edu.location}</span>
                  <span className="italic">{edu.dates}</span>
                </div>
                {edu.details.map((detail, dIdx) => (
                  <div key={dIdx} className="text-sm mt-1 text-gray-800 pl-2 border-l-2 border-gray-200">
                    {detail}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* Technical Setup (Conditional) */}
        {data.technicalSetup && data.technicalSetup.length > 0 && (
          <section className="mb-4 break-inside-avoid">
            <h3 className="text-sm font-bold uppercase border-b border-gray-300 mb-2 tracking-wide text-gray-700">Technical Setup (Remote Work)</h3>
            <ul className="list-disc list-inside text-sm text-gray-800">
              {data.technicalSetup.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Additional Info (Conditional) */}
        {data.additionalInfo && data.additionalInfo.length > 0 && (
          <section className="mb-0 break-inside-avoid">
             <h3 className="text-sm font-bold uppercase border-b border-gray-300 mb-2 tracking-wide text-gray-700">Additional Information</h3>
             <ul className="list-disc list-inside text-sm text-gray-800">
              {data.additionalInfo.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
};

export default ResumePaper;