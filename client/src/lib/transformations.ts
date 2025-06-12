export interface TransformationFunction {
  name: string;
  category: 'String' | 'Math' | 'Date';
  description: string;
  template: string;
  examples: string[];
}

export const TRANSFORMATION_FUNCTIONS: TransformationFunction[] = [
  // String Functions
  {
    name: 'UPPER',
    category: 'String',
    description: 'Convert text to uppercase',
    template: 'UPPER(column_name)',
    examples: ['UPPER(name)', 'UPPER(email)'],
  },
  {
    name: 'LOWER',
    category: 'String',
    description: 'Convert text to lowercase',
    template: 'LOWER(column_name)',
    examples: ['LOWER(name)', 'LOWER(email)'],
  },
  {
    name: 'TRIM',
    category: 'String',
    description: 'Remove leading and trailing spaces',
    template: 'TRIM(column_name)',
    examples: ['TRIM(name)', 'TRIM(address)'],
  },
  {
    name: 'CONCAT',
    category: 'String',
    description: 'Concatenate multiple values',
    template: 'CONCAT(column1, column2)',
    examples: ['CONCAT(first_name, last_name)', 'CONCAT(city, ", ", state)'],
  },
  
  // Math Functions
  {
    name: 'ROUND',
    category: 'Math',
    description: 'Round number to specified decimal places',
    template: 'ROUND(column_name, decimals)',
    examples: ['ROUND(price, 2)', 'ROUND(average, 1)'],
  },
  {
    name: 'ABS',
    category: 'Math',
    description: 'Get absolute value',
    template: 'ABS(column_name)',
    examples: ['ABS(temperature)', 'ABS(profit_loss)'],
  },
  {
    name: 'CEIL',
    category: 'Math',
    description: 'Round up to nearest integer',
    template: 'CEIL(column_name)',
    examples: ['CEIL(price)', 'CEIL(rating)'],
  },
  {
    name: 'FLOOR',
    category: 'Math',
    description: 'Round down to nearest integer',
    template: 'FLOOR(column_name)',
    examples: ['FLOOR(price)', 'FLOOR(score)'],
  },
  
  // Date Functions
  {
    name: 'DATE_FORMAT',
    category: 'Date',
    description: 'Format date to specified format',
    template: 'DATE_FORMAT(column_name, "format")',
    examples: ['DATE_FORMAT(created_at, "YYYY-MM-DD")', 'DATE_FORMAT(birth_date, "MM/DD/YYYY")'],
  },
  {
    name: 'EXTRACT',
    category: 'Date',
    description: 'Extract part of date (year, month, day)',
    template: 'EXTRACT(part, column_name)',
    examples: ['EXTRACT("year", created_at)', 'EXTRACT("month", birth_date)'],
  },
];

// Utility functions for transformation validation
export function validateExpression(expression: string): { isValid: boolean; error?: string } {
  try {
    // Basic validation - check if it matches function pattern
    const functionPattern = /^(\w+)\([^)]*\)$/;
    if (!functionPattern.test(expression.trim())) {
      return { isValid: false, error: 'Expression must be in function format: FUNCTION(arguments)' };
    }

    const functionName = expression.match(/^(\w+)\(/)?.[1];
    if (!functionName) {
      return { isValid: false, error: 'Could not parse function name' };
    }

    const supportedFunctions = TRANSFORMATION_FUNCTIONS.map(f => f.name);
    if (!supportedFunctions.includes(functionName)) {
      return { isValid: false, error: `Unsupported function: ${functionName}` };
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: 'Invalid expression format' };
  }
}

export function getFunctionByName(name: string): TransformationFunction | undefined {
  return TRANSFORMATION_FUNCTIONS.find(f => f.name === name);
}

export function getFunctionsByCategory(category: TransformationFunction['category']): TransformationFunction[] {
  return TRANSFORMATION_FUNCTIONS.filter(f => f.category === category);
}
