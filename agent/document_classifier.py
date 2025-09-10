"""
Intelligent Document Classifier for Dynamic Summary Prompt Selection

This module analyzes document content to determine the domain/industry type
and provides expert-level, domain-specific summary prompts.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from enum import Enum
from dataclasses import dataclass

from .agent import rag_agent, AgentDependencies

logger = logging.getLogger(__name__)


class DocumentDomain(Enum):
    """Supported document domains with expert specializations."""
    ENVIRONMENTAL = "environmental"
    FINANCIAL_BANKING = "financial_banking"
    LEGAL = "legal"
    MEDICAL_HEALTHCARE = "medical_healthcare"
    TECHNICAL_ENGINEERING = "technical_engineering"
    BUSINESS_OPERATIONS = "business_operations"
    REAL_ESTATE = "real_estate"
    REGULATORY_COMPLIANCE = "regulatory_compliance"
    INSURANCE = "insurance"
    ENERGY_UTILITIES = "energy_utilities"
    MANUFACTURING = "manufacturing"
    CONSTRUCTION = "construction"
    GENERAL = "general"


@dataclass
class DomainClassification:
    """Result of document domain classification."""
    domain: DocumentDomain
    confidence: float
    reasoning: str
    keywords: List[str]


class DocumentClassifier:
    """
    Intelligent document classifier that determines document domain
    and provides expert-level summary prompts.
    """
    
    def __init__(self):
        self.domain_keywords = {
            DocumentDomain.ENVIRONMENTAL: [
                "environmental", "ESA", "Phase I", "Phase II", "contamination", "soil", "groundwater",
                "UST", "underground storage tank", "remediation", "CERCLA", "RCRA", "EPA", "environmental compliance",
                "air quality", "water quality", "emissions", "pollution", "hazardous materials", "waste",
                "environmental impact", "ecological", "sustainability", "carbon footprint", "climate",
                "environmental assessment", "environmental audit", "environmental due diligence"
            ],
            DocumentDomain.FINANCIAL_BANKING: [
                "financial", "banking", "credit", "loan", "mortgage", "asset", "liability", "revenue",
                "profit", "loss", "balance sheet", "income statement", "cash flow", "investment",
                "portfolio", "risk assessment", "regulatory capital", "Basel", "stress test",
                "liquidity", "capital adequacy", "ROA", "ROE", "NPL", "provision", "derivatives",
                "securities", "bonds", "equity", "valuation", "financial analysis", "audit"
            ],
            DocumentDomain.LEGAL: [
                "legal", "contract", "agreement", "litigation", "lawsuit", "court", "settlement",
                "intellectual property", "patent", "trademark", "copyright", "compliance",
                "regulatory", "statute", "law", "legal opinion", "brief", "motion", "discovery",
                "deposition", "arbitration", "mediation", "liability", "indemnification",
                "terms and conditions", "privacy policy", "employment law", "corporate law"
            ],
            DocumentDomain.MEDICAL_HEALTHCARE: [
                "medical", "healthcare", "patient", "clinical", "diagnosis", "treatment", "therapy",
                "pharmaceutical", "drug", "medication", "clinical trial", "FDA", "medical device",
                "hospital", "clinic", "physician", "nurse", "medical record", "HIPAA",
                "health insurance", "Medicare", "Medicaid", "epidemiology", "public health",
                "medical research", "biomedical", "pathology", "radiology", "surgery"
            ],
            DocumentDomain.TECHNICAL_ENGINEERING: [
                "engineering", "technical", "specification", "design", "blueprint", "CAD",
                "manufacturing", "quality control", "testing", "validation", "certification",
                "standards", "ISO", "ASTM", "mechanical", "electrical", "civil", "chemical",
                "software", "hardware", "system architecture", "technical documentation",
                "maintenance", "troubleshooting", "performance", "optimization"
            ],
            DocumentDomain.BUSINESS_OPERATIONS: [
                "business", "operations", "strategy", "management", "organizational", "HR",
                "human resources", "employee", "training", "policy", "procedure", "workflow",
                "process improvement", "efficiency", "productivity", "KPI", "metrics",
                "performance", "budget", "planning", "project management", "supply chain",
                "vendor", "customer", "market analysis", "competitive analysis"
            ],
            DocumentDomain.REAL_ESTATE: [
                "real estate", "property", "appraisal", "valuation", "market analysis", "zoning",
                "development", "construction", "lease", "rental", "property management",
                "commercial real estate", "residential", "land use", "planning", "title",
                "deed", "mortgage", "property tax", "HOA", "condominium", "apartment",
                "office building", "retail space", "industrial property", "warehouse"
            ],
            DocumentDomain.REGULATORY_COMPLIANCE: [
                "regulatory", "compliance", "audit", "inspection", "violation", "penalty",
                "enforcement", "regulation", "policy", "procedure", "standard", "guideline",
                "reporting", "documentation", "certification", "accreditation", "oversight",
                "monitoring", "review", "assessment", "corrective action", "remediation",
                "governance", "risk management", "internal controls", "SOX", "GDPR"
            ],
            DocumentDomain.INSURANCE: [
                "insurance", "policy", "claim", "coverage", "premium", "deductible", "underwriting",
                "actuarial", "risk assessment", "loss adjustment", "property insurance",
                "casualty insurance", "life insurance", "health insurance", "auto insurance",
                "workers compensation", "liability insurance", "reinsurance", "catastrophe",
                "flood insurance", "earthquake insurance", "cyber insurance"
            ],
            DocumentDomain.ENERGY_UTILITIES: [
                "energy", "utility", "power", "electricity", "gas", "oil", "renewable",
                "solar", "wind", "hydroelectric", "nuclear", "grid", "transmission",
                "distribution", "generation", "pipeline", "refinery", "drilling",
                "exploration", "production", "environmental impact", "regulatory",
                "utility commission", "rate setting", "infrastructure", "maintenance"
            ],
            DocumentDomain.MANUFACTURING: [
                "manufacturing", "production", "assembly", "quality control", "supply chain",
                "inventory", "warehouse", "logistics", "lean manufacturing", "six sigma",
                "process improvement", "automation", "machinery", "equipment", "maintenance",
                "safety", "OSHA", "industrial", "factory", "plant", "facility",
                "raw materials", "finished goods", "production planning", "scheduling"
            ],
            DocumentDomain.CONSTRUCTION: [
                "construction", "building", "contractor", "subcontractor", "project management",
                "architecture", "structural", "foundation", "concrete", "steel", "plumbing",
                "electrical", "HVAC", "roofing", "flooring", "permits", "inspection",
                "safety", "OSHA", "construction management", "schedule", "budget",
                "materials", "equipment", "site preparation", "excavation"
            ]
        }
    
    async def classify_document(
        self,
        document: Dict[str, Any],
        sample_chunks: List[Dict[str, Any]]
    ) -> DomainClassification:
        """
        Classify a document's domain based on title, content, and metadata.
        
        Args:
            document: Document metadata
            sample_chunks: Sample content chunks for analysis
            
        Returns:
            Domain classification with confidence and reasoning
        """
        try:
            # Prepare content for analysis
            title = document.get('title', '')
            filename = document.get('name', '')
            
            # Get sample content (first 2000 chars from chunks)
            sample_content = ""
            for chunk in sample_chunks[:5]:
                content = chunk.get('content', '')
                sample_content += content[:400] + " "
                if len(sample_content) > 2000:
                    break
            
            # Combine text for analysis
            analysis_text = f"{title} {filename} {sample_content}".lower()
            
            # Calculate keyword scores for each domain
            domain_scores = {}
            matched_keywords = {}
            
            for domain, keywords in self.domain_keywords.items():
                score = 0
                domain_keywords = []
                
                for keyword in keywords:
                    keyword_lower = keyword.lower()
                    # Count occurrences and weight by keyword importance
                    count = analysis_text.count(keyword_lower)
                    if count > 0:
                        # Weight longer, more specific keywords higher
                        weight = len(keyword_lower) / 10 + 1
                        score += count * weight
                        domain_keywords.append(keyword)
                
                domain_scores[domain] = score
                matched_keywords[domain] = domain_keywords
            
            # Find highest scoring domain
            if not domain_scores or max(domain_scores.values()) == 0:
                # Use AI classification as fallback
                return await self._ai_classify_document(document, sample_content)
            
            best_domain = max(domain_scores.keys(), key=lambda k: domain_scores[k])
            best_score = domain_scores[best_domain]
            total_score = sum(domain_scores.values())
            
            # Calculate confidence
            confidence = min(best_score / (total_score + 1), 0.95)
            
            # If confidence is too low, use AI classification
            if confidence < 0.3:
                return await self._ai_classify_document(document, sample_content)
            
            return DomainClassification(
                domain=best_domain,
                confidence=confidence,
                reasoning=f"Keyword analysis identified {len(matched_keywords[best_domain])} relevant terms",
                keywords=matched_keywords[best_domain][:10]  # Top 10 keywords
            )
            
        except Exception as e:
            logger.error(f"Document classification failed: {e}")
            return DomainClassification(
                domain=DocumentDomain.GENERAL,
                confidence=0.5,
                reasoning="Classification failed, using general domain",
                keywords=[]
            )
    
    async def _ai_classify_document(
        self,
        document: Dict[str, Any],
        sample_content: str
    ) -> DomainClassification:
        """
        Use AI agent to classify document when keyword analysis is insufficient.
        """
        try:
            title = document.get('title', 'Unknown')
            
            # Create classification prompt
            domains_list = "\n".join([
                f"- {domain.value}: {domain.name.replace('_', ' ').title()}"
                for domain in DocumentDomain
            ])
            
            prompt = f"""
Analyze this document and classify it into the most appropriate domain category.

Document Title: {title}
Content Sample: {sample_content[:1500]}

Available Domains:
{domains_list}

Respond with ONLY a JSON object in this format:
{{
    "domain": "domain_value",
    "confidence": 0.85,
    "reasoning": "Brief explanation of classification decision",
    "keywords": ["keyword1", "keyword2", "keyword3"]
}}

Choose the domain that best matches the document's primary subject matter and purpose.
"""
            
            deps = AgentDependencies(session_id=f"classify_{document.get('id', 'unknown')}")
            result = await rag_agent.run(prompt, deps=deps)
            
            # Parse AI response
            import json
            try:
                ai_response = json.loads(result.data)
                domain_value = ai_response.get('domain', 'general')
                
                # Map domain value to enum
                domain = DocumentDomain.GENERAL
                for d in DocumentDomain:
                    if d.value == domain_value:
                        domain = d
                        break
                
                return DomainClassification(
                    domain=domain,
                    confidence=float(ai_response.get('confidence', 0.5)),
                    reasoning=ai_response.get('reasoning', 'AI classification'),
                    keywords=ai_response.get('keywords', [])
                )
                
            except (json.JSONDecodeError, KeyError, ValueError):
                logger.warning("Failed to parse AI classification response")
                return DomainClassification(
                    domain=DocumentDomain.GENERAL,
                    confidence=0.5,
                    reasoning="AI classification parsing failed",
                    keywords=[]
                )
                
        except Exception as e:
            logger.error(f"AI document classification failed: {e}")
            return DomainClassification(
                domain=DocumentDomain.GENERAL,
                confidence=0.5,
                reasoning="AI classification failed",
                keywords=[]
            )
    
    def get_domain_expert_prompt(
        self,
        domain: DocumentDomain,
        summary_type: str,
        document_info: Dict[str, Any]
    ) -> str:
        """
        Generate expert-level summary prompt based on document domain.
        
        Args:
            domain: Classified document domain
            summary_type: Type of summary requested
            document_info: Document metadata
            
        Returns:
            Domain-specific expert prompt
        """
        doc_title = document_info.get('title', 'Document')
        
        # Base expert context for each domain
        expert_contexts = {
            DocumentDomain.ENVIRONMENTAL: {
                "role": "Senior Environmental Consultant with 15+ years in environmental due diligence, remediation, and regulatory compliance",
                "expertise": "Phase I/II ESAs, contamination assessment, UST systems, CERCLA/RCRA compliance, environmental risk evaluation",
                "focus_areas": ["Environmental liabilities", "Regulatory compliance status", "Contamination risks", "Remediation requirements", "Cost implications", "Due diligence findings"],
                "terminology": "Use proper environmental terminology including REC (Recognized Environmental Conditions), HREC (Historical RECs), de minimis conditions, and regulatory standards"
            },
            DocumentDomain.FINANCIAL_BANKING: {
                "role": "Senior Financial Analyst and Banking Specialist with CFA designation and 12+ years in financial analysis and risk assessment",
                "expertise": "Financial statement analysis, credit risk assessment, regulatory compliance, Basel III requirements, stress testing",
                "focus_areas": ["Financial performance metrics", "Risk indicators", "Regulatory compliance", "Capital adequacy", "Liquidity position", "Credit quality"],
                "terminology": "Use financial metrics like ROA, ROE, NIM, efficiency ratios, NPL ratios, and regulatory capital terms"
            },
            DocumentDomain.LEGAL: {
                "role": "Senior Corporate Attorney with expertise in commercial law, contracts, and regulatory compliance",
                "expertise": "Contract analysis, litigation risk, intellectual property, regulatory compliance, corporate governance",
                "focus_areas": ["Legal risks and liabilities", "Contractual obligations", "Compliance requirements", "Litigation exposure", "Intellectual property issues", "Regulatory implications"],
                "terminology": "Use precise legal terminology and cite relevant statutes, regulations, and legal precedents"
            },
            DocumentDomain.MEDICAL_HEALTHCARE: {
                "role": "Healthcare Administrator and Medical Affairs Specialist with clinical and regulatory expertise",
                "expertise": "Clinical operations, FDA regulations, healthcare compliance, medical device regulations, pharmaceutical affairs",
                "focus_areas": ["Clinical outcomes", "Regulatory compliance", "Patient safety", "Quality metrics", "Healthcare economics", "Risk management"],
                "terminology": "Use medical terminology, regulatory standards (FDA, HIPAA), and clinical quality indicators"
            },
            DocumentDomain.TECHNICAL_ENGINEERING: {
                "role": "Senior Engineering Manager with expertise in technical systems, quality assurance, and project management",
                "expertise": "Technical specifications, quality control, system design, engineering standards, project execution",
                "focus_areas": ["Technical performance", "Quality metrics", "System reliability", "Engineering standards compliance", "Project milestones", "Risk factors"],
                "terminology": "Use engineering terminology, technical specifications, industry standards (ISO, ASTM), and performance metrics"
            },
            DocumentDomain.BUSINESS_OPERATIONS: {
                "role": "Senior Operations Director with expertise in business strategy, process optimization, and performance management",
                "expertise": "Operations management, strategic planning, process improvement, performance analytics, organizational development",
                "focus_areas": ["Operational efficiency", "Strategic objectives", "Performance metrics", "Process improvements", "Risk factors", "Resource allocation"],
                "terminology": "Use business terminology, KPIs, operational metrics, and strategic frameworks"
            },
            DocumentDomain.REAL_ESTATE: {
                "role": "Senior Real Estate Professional with expertise in property valuation, market analysis, and investment evaluation",
                "expertise": "Property valuation, market analysis, real estate finance, development projects, property management",
                "focus_areas": ["Property valuation", "Market conditions", "Investment potential", "Development opportunities", "Zoning compliance", "Property risks"],
                "terminology": "Use real estate terminology including cap rates, NOI, property types, zoning classifications, and market indicators"
            },
            DocumentDomain.REGULATORY_COMPLIANCE: {
                "role": "Senior Compliance Officer with expertise in regulatory frameworks and risk management",
                "expertise": "Regulatory compliance, audit procedures, risk assessment, policy development, enforcement actions",
                "focus_areas": ["Compliance status", "Regulatory requirements", "Audit findings", "Risk assessments", "Corrective actions", "Policy adherence"],
                "terminology": "Use compliance terminology, regulatory frameworks, audit standards, and risk management concepts"
            },
            DocumentDomain.INSURANCE: {
                "role": "Senior Insurance Professional with expertise in underwriting, claims, and risk assessment",
                "expertise": "Insurance underwriting, claims analysis, risk assessment, actuarial analysis, policy coverage",
                "focus_areas": ["Coverage analysis", "Risk assessment", "Claims patterns", "Underwriting factors", "Loss experience", "Premium adequacy"],
                "terminology": "Use insurance terminology including coverage types, policy terms, underwriting factors, and actuarial concepts"
            },
            DocumentDomain.ENERGY_UTILITIES: {
                "role": "Senior Energy Industry Analyst with expertise in utility operations and energy markets",
                "expertise": "Energy generation, transmission systems, regulatory compliance, market analysis, infrastructure planning",
                "focus_areas": ["System reliability", "Regulatory compliance", "Market conditions", "Infrastructure needs", "Environmental impact", "Operational efficiency"],
                "terminology": "Use energy industry terminology including generation capacity, transmission, distribution, and regulatory frameworks"
            },
            DocumentDomain.MANUFACTURING: {
                "role": "Senior Manufacturing Executive with expertise in production operations and quality management",
                "expertise": "Manufacturing operations, quality control, supply chain management, lean manufacturing, industrial safety",
                "focus_areas": ["Production efficiency", "Quality metrics", "Supply chain performance", "Safety compliance", "Cost optimization", "Process improvements"],
                "terminology": "Use manufacturing terminology including production metrics, quality standards, lean principles, and safety regulations"
            },
            DocumentDomain.CONSTRUCTION: {
                "role": "Senior Construction Manager with expertise in project management and construction operations",
                "expertise": "Construction project management, building codes, safety compliance, cost estimation, schedule management",
                "focus_areas": ["Project progress", "Safety compliance", "Cost management", "Schedule adherence", "Quality control", "Regulatory compliance"],
                "terminology": "Use construction terminology including project phases, building codes, safety standards, and construction methods"
            },
            DocumentDomain.GENERAL: {
                "role": "Senior Business Analyst with broad expertise across multiple industries",
                "expertise": "Document analysis, business operations, strategic planning, risk assessment, performance evaluation",
                "focus_areas": ["Key findings", "Strategic implications", "Risk factors", "Performance indicators", "Recommendations", "Action items"],
                "terminology": "Use clear, professional business terminology appropriate to the document context"
            }
        }
        
        expert_info = expert_contexts.get(domain, expert_contexts[DocumentDomain.GENERAL])
        
        # Generate domain-specific prompt based on summary type
        if summary_type == "executive":
            return f"""
You are a {expert_info['role']}. 

Analyze this {domain.value.replace('_', ' ')} document: "{doc_title}" and provide an EXECUTIVE SUMMARY from your expert perspective.

Your analysis should demonstrate deep domain expertise in: {expert_info['expertise']}.

Focus on these critical areas:
{chr(10).join(f"• {area}" for area in expert_info['focus_areas'])}

Executive Summary Requirements:
• Lead with the most critical business impacts and strategic implications
• Highlight key risks, opportunities, and financial implications
• Provide actionable insights and recommendations for decision-makers
• Identify any compliance, regulatory, or operational concerns
• Assess overall significance and priority level
• Use executive-level language appropriate for C-suite review

{expert_info['terminology']}

Structure your response as a comprehensive executive brief that enables informed decision-making.
"""
        
        elif summary_type == "financial":
            return f"""
You are a {expert_info['role']} with specialized focus on financial and economic analysis.

Analyze this {domain.value.replace('_', ' ')} document: "{doc_title}" and provide a FINANCIAL ANALYSIS SUMMARY.

Your expertise includes: {expert_info['expertise']}.

Financial Focus Areas:
• Cost implications and financial exposure
• Revenue/income impacts and opportunities  
• Budget considerations and resource requirements
• ROI analysis and economic justification
• Financial risks and mitigation strategies
• Capital requirements and funding needs
• Cost-benefit analysis of recommendations

Extract and analyze:
• All monetary amounts, costs, and financial projections
• Budget variances and financial performance indicators
• Economic assumptions and financial modeling inputs
• Cash flow implications and timing considerations
• Financial compliance and reporting requirements

{expert_info['terminology']}

Provide quantitative analysis where possible and highlight financial decision-making factors.
"""
        
        elif summary_type == "operational":
            return f"""
You are a {expert_info['role']} focused on operational excellence and performance optimization.

Analyze this {domain.value.replace('_', ' ')} document: "{doc_title}" and provide an OPERATIONAL ANALYSIS SUMMARY.

Your operational expertise covers: {expert_info['expertise']}.

Operational Focus Areas:
• Process efficiency and performance metrics
• Resource utilization and capacity planning
• Quality control and performance standards
• System reliability and operational risks
• Workflow optimization and process improvements
• Compliance with operational procedures
• Performance gaps and improvement opportunities

Analyze:
• Current operational status and performance levels
• Process bottlenecks and efficiency opportunities
• Resource allocation and utilization rates
• Quality metrics and performance indicators
• Operational risks and mitigation measures
• Implementation timelines and resource requirements

{expert_info['terminology']}

Focus on actionable operational improvements and performance optimization strategies.
"""
        
        else:  # comprehensive
            return f"""
You are a {expert_info['role']} providing comprehensive expert analysis.

Analyze this {domain.value.replace('_', ' ')} document: "{doc_title}" from your specialized perspective.

Your deep expertise encompasses: {expert_info['expertise']}.

Comprehensive Analysis Framework:
{chr(10).join(f"• {area}" for area in expert_info['focus_areas'])}

Provide a thorough analysis covering:

EXECUTIVE OVERVIEW:
• Strategic significance and business impact
• Key findings and critical insights
• Priority level and urgency indicators

TECHNICAL/DOMAIN ANALYSIS:
• Detailed findings specific to {domain.value.replace('_', ' ')} domain
• Technical merit and professional assessment
• Industry standards and best practices compliance

RISK ASSESSMENT:
• Primary risks and exposure factors
• Risk mitigation strategies and recommendations
• Monitoring and control measures

STRATEGIC RECOMMENDATIONS:
• Actionable next steps and priorities
• Resource requirements and timeline considerations
• Success metrics and performance indicators

COMPLIANCE & STANDARDS:
• Regulatory compliance status
• Industry standard adherence
• Certification and accreditation considerations

{expert_info['terminology']}

Demonstrate the depth of expertise expected from a senior professional in this field. Provide insights that only an experienced practitioner would identify.
"""


# Singleton instance
document_classifier = DocumentClassifier()