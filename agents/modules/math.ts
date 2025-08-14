import { Agent, AgentResponse } from '@/types'

export class MathAgent implements Agent {
  name = 'Math Calculator'
  description = 'Perform mathematical calculations and solve equations'
  trigger = /@math|calculate|math|solve|equation|formula|compute|sum|multiply|divide|percentage/i

  async run(input: string): Promise<AgentResponse> {
    try {
      // Extract mathematical expression from input
      let expression = input.replace(/@math\s*/i, '').trim()
      
      // Basic math expression cleaning and validation
      expression = this.cleanExpression(expression)
      
      // Validate expression (only allow safe characters)
      if (!this.isValidExpression(expression)) {
        throw new Error('Invalid mathematical expression')
      }

      // Calculate result using eval (in a controlled way)
      const result = this.safeEval(expression)
      
      return {
        id: `math-${Date.now()}`,
        data: {
          expression: expression,
          result: result,
          formatted: this.formatResult(result),
          steps: this.generateSteps(expression, result),
        },
        type: 'json',
        metadata: {
          source: 'math_calculator',
          timestamp: Date.now(),
        }
      }
    } catch (error) {
      console.error('Math agent error:', error)
      
      return {
        id: `math-${Date.now()}`,
        data: {
          expression: input,
          error: 'Cannot calculate this expression',
          message: 'Please provide a valid mathematical expression (e.g., "2 + 2", "15% of 200", "sqrt(25)")',
          examples: [
            'Basic: 2 + 2, 10 - 3, 5 * 4, 15 / 3',
            'Percentages: 15% of 200, 25% increase of 100',
            'Powers: 2^3, 5 to the power of 2',
            'Functions: sqrt(25), sin(30), cos(60)'
          ]
        },
        type: 'json',
        metadata: {
          source: 'math_fallback',
          timestamp: Date.now(),
          error: true,
        }
      }
    }
  }

  private cleanExpression(expr: string): string {
    // Convert common math phrases to operators
    expr = expr.replace(/\bpercent of\b/gi, '% of')
    expr = expr.replace(/\bto the power of\b/gi, '^')
    expr = expr.replace(/\bsquare root of\b/gi, 'sqrt')
    expr = expr.replace(/\btimes\b/gi, '*')
    expr = expr.replace(/\bdivided by\b/gi, '/')
    expr = expr.replace(/\bplus\b/gi, '+')
    expr = expr.replace(/\bminus\b/gi, '-')
    
    // Handle percentage calculations
    if (expr.includes('% of')) {
      const match = expr.match(/(\d+(?:\.\d+)?)%\s*of\s*(\d+(?:\.\d+)?)/i)
      if (match) {
        const percent = parseFloat(match[1])
        const number = parseFloat(match[2])
        expr = `(${percent} / 100) * ${number}`
      }
    }
    
    return expr.trim()
  }

  private isValidExpression(expr: string): boolean {
    // Only allow safe mathematical characters and functions
    const safePattern = /^[0-9+\-*/.()^\s%sqrtsincostan]+$/i
    return safePattern.test(expr) && !expr.includes('__') && !expr.includes('eval')
  }

  private safeEval(expr: string): number {
    // Replace ^ with ** for JavaScript exponentiation
    expr = expr.replace(/\^/g, '**')
    
    // Handle basic math functions
    expr = expr.replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)')
    expr = expr.replace(/sin\(([^)]+)\)/g, 'Math.sin($1 * Math.PI / 180)')
    expr = expr.replace(/cos\(([^)]+)\)/g, 'Math.cos($1 * Math.PI / 180)')
    expr = expr.replace(/tan\(([^)]+)\)/g, 'Math.tan($1 * Math.PI / 180)')
    
    // Use Function constructor instead of eval for better security
    const result = new Function('return ' + expr)()
    
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Invalid calculation result')
    }
    
    return result
  }

  private formatResult(result: number): string {
    // Format result with appropriate precision
    if (Number.isInteger(result)) {
      return result.toString()
    } else {
      return result.toFixed(6).replace(/\.?0+$/, '')
    }
  }

  private generateSteps(expression: string, result: number): string[] {
    // Simple step generation for basic operations
    return [
      `Expression: ${expression}`,
      `Result: ${this.formatResult(result)}`
    ]
  }
}
