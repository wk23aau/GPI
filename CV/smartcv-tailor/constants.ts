import { ResumeData } from './types';

export const INITIAL_RESUME: ResumeData = {
  personalInfo: {
    name: "WASEEM RAZA KHAN",
    title: "Staff Infrastructure & Automation Engineer",
    address: "London, SW17 0DN | UK",
    phone: "+447404132345",
    email: "waseemrazakhansqa@gmail.com"
  },
  summary: "Infrastructure and Automation Engineer with expertise in cloud-native technologies and CI/CD pipelines. Experienced in designing, building, and operating distributed systems using Docker, Kubernetes, and Linux. Currently pursuing an MSc in Data Science, bringing a unique perspective to AI/ML pipeline testing and optimization. Passionate about Infrastructure as Code, reliability engineering, and mentoring teams on cloud best practices.",
  skills: [
    {
      category: "Cloud & Infrastructure",
      items: ["Docker (Containerization)", "Kubernetes", "Linux/UNIX Administration", "AWS (Fundamentals)", "Infrastructure as Code"]
    },
    {
      category: "CI/CD & DevOps",
      items: ["GitHub Actions", "Jenkins", "GitLab CI", "Pipeline Automation", "Deployment Pipelines"]
    },
    {
      category: "Languages & Scripting",
      items: ["Python (Advanced)", "Bash/Shell Scripting", "JavaScript/TypeScript"]
    },
    {
      category: "Distributed Systems",
      items: ["Microservices Architecture", "API Design & Testing", "High-Availability Systems", "Performance Engineering"]
    },
    {
      category: "AI/ML Operations",
      items: ["Model Evaluation", "Data Validation Pipelines", "GPU Resource Monitoring", "ML Pipeline Testing"]
    },
    {
      category: "Databases & Tools",
      items: ["PostgreSQL", "SQL", "Git", "Postman", "Jira", "Agile/Scrum"]
    }
  ],
  experience: [
    {
      company: "Archopinion",
      location: "London, UK",
      role: "AI Quality Engineer / ML Infrastructure",
      dates: "Jan 2024 – Present | Part-Time",
      description: "Building and maintaining infrastructure for AI-driven document analysis platform.",
      bullets: [
        "Infrastructure as Code: Designed and implemented CI/CD pipelines for automated model deployment, ensuring only validated models reach production.",
        "Container Management: Managed Docker containers for model inference, optimizing resource allocation and ensuring system stability under GPU-intensive workloads.",
        "Python Automation: Developed Python scripts to automate data validation pipelines, monitoring large datasets for integrity and consistency.",
        "Performance Testing: Conducted comprehensive performance testing to ensure the AI system remained stable under high-concurrency loads.",
        "Cross-functional Collaboration: Worked with Data Scientists and DevOps teams to define testability standards and deployment strategies."
      ]
    },
    {
      company: "Al Yamama Company | NEOM (The LINE)",
      location: "Saudi Arabia",
      role: "Senior Software Engineer (Backend & Systems)",
      dates: "Jan 2023 – Jan 2024 | Full-Time",
      description: "Focused on reliability of distributed tracking systems across enterprise infrastructure.",
      bullets: [
        "Distributed Systems: Validated and maintained a distributed RFID tracking system across multiple physical sites, ensuring high availability and data consistency.",
        "Linux Administration: Managed Linux-based production servers, implementing Bash scripts for automated health checks, log rotation, and system monitoring.",
        "API & Database QA: Built automated API tests verifying secure data transmission between nodes and cloud, ensuring data privacy and integrity.",
        "Performance Engineering: Optimized PostgreSQL queries and backend logic to handle high-concurrency data streams with sub-second response times."
      ]
    },
    {
      company: "Amigo Software",
      location: "Lahore, Pakistan",
      role: "QA Automation Engineer",
      dates: "Oct 2020 – Dec 2023 | Full-Time",
      description: "Core infrastructure QA for real-time web communication platform.",
      bullets: [
        "Test Automation Frameworks: Developed automated test suites for Rainbow Classroom, a high-availability communication platform.",
        "Pipeline Management: Enforced quality gates in CI/CD release processes, reducing production defects by systematic testing.",
        "Root Cause Analysis: Investigated complex distributed system failures using logs and monitoring tools to isolate issues."
      ]
    },
    {
      company: "Eyecix Solutions",
      location: "Lahore, Pakistan",
      role: "Frontend Developer / Infrastructure Support",
      dates: "July 2019 – Oct 2020 | Full-Time",
      description: "",
      bullets: [
        "Full-Stack Foundation: Developed responsive web applications using HTML, CSS, JavaScript, gaining foundational understanding of deployment workflows.",
        "Development Environment: Set up and maintained local development environments, learning containerization and version control best practices."
      ]
    }
  ],
  education: [
    {
      degree: "MSc Data Science & Analytics (Advanced Research)",
      institution: "University of Hertfordshire",
      location: "Hertfordshire, UK",
      dates: "2024 – December 2025",
      details: [
        "GPA: 3.57 | Focus: ML Pipeline Optimization, Data Validation, AI/ML Infrastructure"
      ]
    },
    {
      degree: "Bachelor of Science (Computer Science)",
      institution: "The Islamia University of Bahawalpur",
      location: "Bahawalpur, PK",
      dates: "2015 – 2019",
      details: [
        "GPA: 3.3/4.0 | Distributed Systems, Database Management, Software Engineering"
      ]
    }
  ],
  additionalInfo: [
    "Available Immediately | Full Right to Work in UK",
    "GitHub & HuggingFace portfolio available upon request"
  ]
};