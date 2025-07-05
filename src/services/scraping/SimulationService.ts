/**
 * Simulation Service
 * 
 * Generates realistic test data for development without hitting production APIs.
 * Single responsibility for data simulation during development.
 * 
 * AIDEV-NOTE: Focused simulation service extracted from appeal downloader
 */

import type { ISimulationService, AppealCaseData } from './interfaces.js';

export class SimulationService implements ISimulationService {

  generateSimulatedCase(caseId: string, url: string): AppealCaseData {
    const seed = parseInt(caseId) % 10000;
    
    return {
      case_id: caseId,
      doc_link_span: url,
      case_type: this.getCaseType(seed),
      start_date: this.generateStartDate(seed),
      lpa_name: this.getLPAName(seed),
      questionnaire_due: this.generateQuestionnaireDate(seed),
      statement_due: this.generateStatementDate(seed),
      case_officer: this.getCaseOfficer(seed),
      interested_party_comments_due: this.generateCommentsDate(seed),
      procedure: this.getProcedure(seed),
      final_comments_due: this.generateFinalCommentsDate(seed),
      status: this.getStatus(seed),
      inquiry_evidence_due: this.generateInquiryEvidenceDate(seed),
      decision_outcome: this.getDecisionOutcome(seed),
      event_date: this.generateEventDate(seed),
      link_status: this.getLinkStatus(seed),
      decision_date: this.generateDecisionDate(seed),
      linked_case_count: this.getLinkedCaseCount(seed),
      content: this.generatePdfContent(caseId, seed)
    };
  }

  private getCaseType(seed: number): string {
    const caseTypes = [
      'Householder Appeal', 'Full Planning Appeal', 'Advertisement Appeal',
      'Listed Building Appeal', 'Enforcement Appeal', 'Commercial Development Appeal',
      'Residential Development Appeal', 'Change of Use Appeal'
    ];
    return caseTypes[seed % caseTypes.length];
  }

  private getLPAName(seed: number): string {
    const lpaNames = [
      'Birmingham City Council', 'Manchester City Council', 'Leeds City Council',
      'Sheffield City Council', 'Bristol City Council', 'Liverpool City Council',
      'Newcastle upon Tyne City Council', 'Nottingham City Council', 'Cardiff Council',
      'Coventry City Council', 'Leicester City Council', 'Sunderland City Council'
    ];
    return lpaNames[seed % lpaNames.length];
  }

  private getCaseOfficer(seed: number): string {
    const caseOfficers = [
      'Sarah Johnson', 'Michael Brown', 'Emma Wilson', 'James Davis',
      'Lisa Thompson', 'David Miller', 'Rachel Green', 'Christopher Lee'
    ];
    return caseOfficers[seed % caseOfficers.length];
  }

  private getProcedure(seed: number): string {
    const procedures = [
      'Written Representations', 'Informal Hearing', 'Public Inquiry',
      'Householder Appeal Service', 'Commercial Appeal Service'
    ];
    return procedures[seed % procedures.length];
  }

  private getDecisionOutcome(seed: number): string {
    const outcomes = [
      'Appeal Allowed', 'Appeal Dismissed', 'Appeal Allowed in Part',
      'Appeal Withdrawn', 'Invalid Appeal', 'Split Decision'
    ];
    return seed % 3 === 0 ? outcomes[seed % outcomes.length] : '';
  }

  private getStatus(seed: number): string {
    return seed % 3 === 0 ? 'Closed' : 'In Progress';
  }

  private getLinkStatus(seed: number): string {
    return seed % 5 === 0 ? 'Linked Case' : 'Standalone';
  }

  private getLinkedCaseCount(seed: number): number {
    return seed % 5 === 0 ? (seed % 3) + 1 : 0;
  }

  private generateStartDate(seed: number): string {
    const startDate = new Date(2020 + (seed % 4), (seed % 12), 1 + (seed % 28));
    return startDate.toLocaleDateString('en-GB');
  }

  private generateQuestionnaireDate(seed: number): string {
    const startDate = new Date(2020 + (seed % 4), (seed % 12), 1 + (seed % 28));
    const questionnaireDate = new Date(startDate.getTime() + 21 * 24 * 60 * 60 * 1000);
    return questionnaireDate.toLocaleDateString('en-GB');
  }

  private generateStatementDate(seed: number): string {
    const startDate = new Date(2020 + (seed % 4), (seed % 12), 1 + (seed % 28));
    const statementDate = new Date(startDate.getTime() + 35 * 24 * 60 * 60 * 1000);
    return statementDate.toLocaleDateString('en-GB');
  }

  private generateCommentsDate(seed: number): string {
    const startDate = new Date(2020 + (seed % 4), (seed % 12), 1 + (seed % 28));
    const commentsDate = new Date(startDate.getTime() + 42 * 24 * 60 * 60 * 1000);
    return commentsDate.toLocaleDateString('en-GB');
  }

  private generateFinalCommentsDate(seed: number): string {
    const startDate = new Date(2020 + (seed % 4), (seed % 12), 1 + (seed % 28));
    const finalDate = new Date(startDate.getTime() + 56 * 24 * 60 * 60 * 1000);
    return finalDate.toLocaleDateString('en-GB');
  }

  private generateInquiryEvidenceDate(seed: number): string {
    const procedures = this.getProcedure(seed);
    if (procedures === 'Public Inquiry') {
      const startDate = new Date(2020 + (seed % 4), (seed % 12), 1 + (seed % 28));
      const inquiryDate = new Date(startDate.getTime() + 70 * 24 * 60 * 60 * 1000);
      return inquiryDate.toLocaleDateString('en-GB');
    }
    return '';
  }

  private generateEventDate(seed: number): string {
    const startDate = new Date(2020 + (seed % 4), (seed % 12), 1 + (seed % 28));
    const eventDate = new Date(startDate.getTime() + (90 + (seed % 180)) * 24 * 60 * 60 * 1000);
    return eventDate.toLocaleDateString('en-GB');
  }

  private generateDecisionDate(seed: number): string {
    if (seed % 3 === 0) {
      const startDate = new Date(2020 + (seed % 4), (seed % 12), 1 + (seed % 28));
      const decisionDate = new Date(startDate.getTime() + (90 + (seed % 180)) * 24 * 60 * 60 * 1000);
      return decisionDate.toLocaleDateString('en-GB');
    }
    return '';
  }

  private generatePdfContent(caseId: string, seed: number): string {
    const templates = [
      this.generateAppealDecisionTemplate(caseId, seed),
      this.generateDecisionNoticeTemplate(caseId, seed)
    ];

    return templates[seed % templates.length];
  }

  private generateAppealDecisionTemplate(caseId: string, seed: number): string {
    return `PLANNING APPEAL DECISION

Appeal Reference: APP/${caseId}/D/23/${String(seed).padStart(6, '0')}
Case ID: ${caseId}

DECISION

The appeal is ${seed % 2 === 0 ? 'ALLOWED' : 'DISMISSED'}.

MAIN ISSUES

The main issues are:
- The effect of the development on the character and appearance of the area
- Whether the development would provide adequate living conditions for future occupants
- The impact on highway safety and parking provision

REASONING AND CONCLUSIONS

${seed % 3 === 0 ? 
  'The proposed development would be in keeping with the established character of the area. The design and scale are appropriate for the local context.' : 
  'The proposed development would have an adverse impact on the character and appearance of the area due to its scale and design.'}

${seed % 2 === 0 ? 
  'The development would provide adequate living conditions with sufficient light, outlook and privacy for future occupants.' : 
  'The development would result in poor living conditions due to inadequate light and privacy.'}

FORMAL DECISION

For the reasons given above, the appeal is ${seed % 2 === 0 ? 'ALLOWED' : 'DISMISSED'}.

Inspector: J. Smith BA(Hons) MRTPI
Date: ${new Date().toLocaleDateString('en-GB')}`;
  }

  private generateDecisionNoticeTemplate(caseId: string, seed: number): string {
    const lpaName = this.getLPAName(seed);
    const caseType = this.getCaseType(seed);

    return `APPEAL DECISION NOTICE

Planning Appeal by ${lpaName}
Appeal Reference: ${caseId}
Site: Land adjacent to residential properties
Development: ${caseType}

PRELIMINARY MATTERS

This appeal relates to an application for planning permission that was refused by ${lpaName}. The refusal was based on concerns about ${
  seed % 4 === 0 ? 'highway safety' : 
  seed % 4 === 1 ? 'visual impact' : 
  seed % 4 === 2 ? 'noise pollution' : 
  'environmental impact'
}.

MAIN CONSIDERATIONS

The determining issues in this case are:
1. Policy compliance with local development plan
2. Impact on residential amenity
3. ${seed % 3 === 0 ? 'Heritage considerations' : seed % 3 === 1 ? 'Environmental protection' : 'Economic benefits'}

ASSESSMENT

${seed % 2 === 0 ? 
  'The proposal accords with the development plan and would not cause significant harm to residential amenity. The benefits of the development outweigh any limited harm.' : 
  'The proposal conflicts with development plan policies and would cause significant harm to residential amenity that is not outweighed by any benefits.'}

CONCLUSION

Having regard to all matters raised, I conclude that the appeal should be ${seed % 2 === 0 ? 'allowed' : 'dismissed'}.

Planning Inspector
Date of Decision: ${new Date().toLocaleDateString('en-GB')}`;
  }
}