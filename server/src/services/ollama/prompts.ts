import { CodeAnalysisResult } from "../codeAnalysis/codeAnalysisEngine";

/**
 * Generate code analysis prompt
 * @param analysis - Code analysis result
 * @returns Prompt string
 */
export function generateCodeAnalysisPrompt(
  analysis: CodeAnalysisResult
): string {
  const analysisText = `
# Code Analysis Report for ${analysis.owner}/${analysis.repositoryName}

## Complexity Metrics
- Function Count: ${analysis.complexity.functionCount}
- Class Count: ${analysis.complexity.classCount}
- Method Count: ${analysis.complexity.methodCount}
- Loop Count: ${analysis.complexity.loopCount}
- Condition Count: ${analysis.complexity.conditionCount}
- Average Cyclomatic Complexity: ${analysis.complexity.averageCyclomaticComplexity.toFixed(2)}
- Max Nesting Level: ${analysis.complexity.maxNestingLevel}

## Lines of Code
- Total Code Lines: ${analysis.lineOfCode.total.code}
- Comments: ${analysis.lineOfCode.total.comment}
- Blank Lines: ${analysis.lineOfCode.total.blank}

## Languages Used
${analysis.languages.map((lang) => `- ${lang.name}: ${lang.percent.toFixed(1)}%`).join("\n")}

## Quality Indicators
- Quality Score: ${analysis.qualityScore}/100
- Development Level: ${analysis.developmentLevel.toUpperCase()}
- Has Tests: ${analysis.hasTests ? "Yes" : "No"}
- Has CI/CD: ${analysis.hasCI ? "Yes" : "No"}
- Uses TypeScript: ${analysis.hasTypeScript ? "Yes" : "No"}
- Has Docker: ${analysis.hasDocker ? "Yes" : "No"}

---

You are an expert software engineer and career advisor. Analyze this code report and provide:

1. **Overall Assessment**: Brief summary of the code quality and development level
2. **Strengths**: What the developer does well (based on the metrics)
3. **Areas for Improvement**: Specific recommendations for skill development
4. **Recommended Skills to Learn**: Based on current stack and industry trends
5. **Next Steps**: Actionable learning path with 3-5 concrete milestones

Format your response as a structured JSON object with these keys:
- assessment
- strengths (array)
- improvements (array)
- recommended_skills (array with {skill: string, reason: string})
- next_steps (array with {milestone: string, description: string, estimated_weeks: number})

Be specific, encouraging, and practical. Focus on real skill development needs based on the code analysis.
`;

  return analysisText;
}

/**
 * Generate roadmap prompt
 * @param analysis - Code analysis result
 * @param targetRole - Target role
 * @returns Prompt string
 */
export function generateRoadmapPrompt(
  analysis: CodeAnalysisResult,
  targetRole: string
): string {
  const prompt = `
# Career Roadmap Generation Request

## Developer Profile
- Repository: ${analysis.owner}/${analysis.repositoryName}
- Current Level: ${analysis.developmentLevel}
- Quality Score: ${analysis.qualityScore}/100
- Primary Languages: ${analysis.languages.slice(0, 3).map((l) => l.name).join(", ")}

## Target Role
${targetRole}

## Code Analysis Summary
${generateCodeAnalysisPrompt(analysis)}

---

Based on this developer's current skill level and the target role, create a detailed learning roadmap.

**Format as JSON with these sections:**
{
  "target_role": "string",
  "current_level": "string",
  "total_estimated_weeks": number,
  "skill_gaps": [
    {
      "skill": "string",
      "importance": "critical|high|medium",
      "current_level": "string",
      "target_level": "string",
      "why": "string"
    }
  ],
  "learning_phases": [
    {
      "phase": number,
      "title": "string",
      "description": "string",
      "estimated_weeks": number,
      "skills_to_learn": ["string"],
      "resources": [
        {
          "title": "string",
          "type": "course|article|project|book",
          "url": "string"
        }
      ],
      "milestone_projects": [
        {
          "title": "string",
          "description": "string",
          "tech_stack": ["string"]
        }
      ]
    }
  ],
  "portfolio_projects": [
    {
      "title": "string",
      "goal": "string",
      "description": "string",
      "tech_stack": ["string"],
      "estimated_weeks": number
    }
  ]
}

Be specific, practical, and aligned with current industry standards for the target role.
`;

  return prompt;
}