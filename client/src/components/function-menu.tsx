import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Settings, 
  X, 
  Plus, 
  Search,
  Type,
  Hash,
  Calendar,
  Calculator,
  FileText,
  Filter,
  RotateCcw,
  Scissors,
  Copy,
  Merge,
  Split,
  ChevronsDown,
  ChevronsUp,
  Zap,
  Minus,
  Divide,
  Circle,
  Square,
  Percent,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  ArrowRight,
  Shield,
  GitBranch,
  Map,
  Package,
  Target,
  Trophy,
  BarChart,
  Eraser,
  Clock
} from "lucide-react";

interface FunctionDefinition {
  id: string;
  name: string;
  category: 'string' | 'math' | 'date' | 'utility' | 'transform';
  description: string;
  icon: React.ReactNode;
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    required: boolean;
    description: string;
    defaultValue?: any;
    options?: Array<{ value: string; label: string }>;
  }>;
  example: string;
}

const AVAILABLE_FUNCTIONS: FunctionDefinition[] = [
  // String Functions
  {
    id: 'lowercase',
    name: 'LOWERCASE',
    category: 'string',
    description: 'Convert text to lowercase',
    icon: <ChevronsDown className="h-4 w-4" />,
    parameters: [],
    example: 'LOWERCASE(column_name)'
  },
  {
    id: 'uppercase', 
    name: 'UPPERCASE',
    category: 'string',
    description: 'Convert text to uppercase',
    icon: <ChevronsUp className="h-4 w-4" />,
    parameters: [],
    example: 'UPPERCASE(column_name)'
  },
  {
    id: 'capitalize',
    name: 'CAPITALIZE',
    category: 'string',
    description: 'Capitalize first letter of each word',
    icon: <Type className="h-4 w-4" />,
    parameters: [],
    example: 'CAPITALIZE(column_name)'
  },
  {
    id: 'trim',
    name: 'TRIM',
    category: 'string',
    description: 'Remove leading and trailing whitespace',
    icon: <Scissors className="h-4 w-4" />,
    parameters: [],
    example: 'TRIM(column_name)'
  },
  {
    id: 'left',
    name: 'LEFT',
    category: 'string',
    description: 'Extract characters from the left',
    icon: <ArrowLeft className="h-4 w-4" />,
    parameters: [
      { name: 'length', type: 'number', required: true, description: 'Number of characters to extract', defaultValue: 3 }
    ],
    example: 'LEFT(column_name, 3)'
  },
  {
    id: 'right',
    name: 'RIGHT',
    category: 'string',
    description: 'Extract characters from the right',
    icon: <ArrowRight className="h-4 w-4" />,
    parameters: [
      { name: 'length', type: 'number', required: true, description: 'Number of characters to extract', defaultValue: 3 }
    ],
    example: 'RIGHT(column_name, 3)'
  },
  {
    id: 'substring',
    name: 'SUBSTRING',
    category: 'string', 
    description: 'Extract part of a string',
    icon: <Split className="h-4 w-4" />,
    parameters: [
      { name: 'start', type: 'number', required: true, description: 'Starting position (0-based)', defaultValue: 0 },
      { name: 'length', type: 'number', required: false, description: 'Number of characters to extract', defaultValue: 5 }
    ],
    example: 'SUBSTRING(column_name, 0, 5)'
  },
  {
    id: 'concat',
    name: 'CONCAT',
    category: 'string',
    description: 'Concatenate multiple values',
    icon: <Merge className="h-4 w-4" />,
    parameters: [
      { name: 'separator', type: 'string', required: false, description: 'String to join values', defaultValue: '' },
      { name: 'output_type', type: 'select', required: true, description: 'Where to output the result', 
        options: [
          { value: 'current_field', label: 'Output to current field' },
          { value: 'new_field', label: 'Create new field' }
        ],
        defaultValue: 'current_field' },
      { name: 'new_field_name', type: 'string', required: false, description: 'Name for new field (if creating new)', defaultValue: 'concatenated_field' }
    ],
    example: 'CONCAT(first_name, " ", last_name)'
  },
  {
    id: 'replace',
    name: 'REPLACE',
    category: 'string',
    description: 'Replace text in string',
    icon: <RotateCcw className="h-4 w-4" />,
    parameters: [
      { name: 'search', type: 'string', required: true, description: 'Text to find', defaultValue: 'old' },
      { name: 'replacement', type: 'string', required: true, description: 'Replacement text', defaultValue: 'new' }
    ],
    example: 'REPLACE(column_name, "old", "new")'
  },
  {
    id: 'split',
    name: 'SPLIT',
    category: 'string',
    description: 'Split text by delimiter and get part',
    icon: <Scissors className="h-4 w-4" />,
    parameters: [
      { name: 'delimiter', type: 'string', required: true, description: 'Character to split on', defaultValue: ',' },
      { name: 'index', type: 'number', required: true, description: 'Part index (0-based)', defaultValue: 0 }
    ],
    example: 'SPLIT(column_name, ",", 0)'
  },
  {
    id: 'length',
    name: 'LENGTH',
    category: 'string',
    description: 'Get the length of text',
    icon: <Hash className="h-4 w-4" />,
    parameters: [],
    example: 'LENGTH(column_name)'
  },
  {
    id: 'reverse',
    name: 'REVERSE',
    category: 'string',
    description: 'Reverse the text',
    icon: <RotateCcw className="h-4 w-4" />,
    parameters: [],
    example: 'REVERSE(column_name)'
  },
  {
    id: 'clean',
    name: 'CLEAN',
    category: 'string',
    description: 'Remove non-printable characters',
    icon: <Eraser className="h-4 w-4" />,
    parameters: [],
    example: 'CLEAN(column_name)'
  },
  {
    id: 'pad_left',
    name: 'PAD_LEFT',
    category: 'string',
    description: 'Pad string on the left to specified length',
    icon: <ArrowLeft className="h-4 w-4" />,
    parameters: [
      { name: 'length', type: 'number', required: true, description: 'Total length desired', defaultValue: 10 },
      { name: 'character', type: 'string', required: false, description: 'Character to pad with', defaultValue: '0' }
    ],
    example: 'PAD_LEFT(column_name, 10, "0")'
  },
  {
    id: 'remove_spaces',
    name: 'REMOVE_SPACES',
    category: 'string',
    description: 'Remove all spaces from text',
    icon: <Eraser className="h-4 w-4" />,
    parameters: [],
    example: 'REMOVE_SPACES(column_name)'
  },

  // Math Functions
  {
    id: 'add',
    name: 'ADD',
    category: 'math',
    description: 'Add two or more numbers',
    icon: <Plus className="h-4 w-4" />,
    parameters: [
      { name: 'value', type: 'number', required: true, description: 'Value to add', defaultValue: 10 }
    ],
    example: 'ADD(column_name, 10)'
  },
  {
    id: 'subtract',
    name: 'SUBTRACT',
    category: 'math',
    description: 'Subtract a number from the value',
    icon: <Minus className="h-4 w-4" />,
    parameters: [
      { name: 'value', type: 'number', required: true, description: 'Value to subtract', defaultValue: 5 }
    ],
    example: 'SUBTRACT(column_name, 5)'
  },
  {
    id: 'multiply',
    name: 'MULTIPLY', 
    category: 'math',
    description: 'Multiply two or more numbers',
    icon: <Zap className="h-4 w-4" />,
    parameters: [
      { name: 'multiplier', type: 'number', required: true, description: 'Value to multiply by', defaultValue: 2 }
    ],
    example: 'MULTIPLY(column_name, 2)'
  },
  {
    id: 'divide',
    name: 'DIVIDE',
    category: 'math',
    description: 'Divide the value by a number',
    icon: <Divide className="h-4 w-4" />,
    parameters: [
      { name: 'divisor', type: 'number', required: true, description: 'Value to divide by', defaultValue: 2 }
    ],
    example: 'DIVIDE(column_name, 2)'
  },
  {
    id: 'round',
    name: 'ROUND',
    category: 'math',
    description: 'Round number to specified decimal places',
    icon: <Circle className="h-4 w-4" />,
    parameters: [
      { name: 'decimals', type: 'number', required: false, description: 'Number of decimal places', defaultValue: 2 }
    ],
    example: 'ROUND(column_name, 2)'
  },
  {
    id: 'ceil',
    name: 'CEIL',
    category: 'math',
    description: 'Round up to nearest integer',
    icon: <TrendingUp className="h-4 w-4" />,
    parameters: [],
    example: 'CEIL(column_name)'
  },
  {
    id: 'floor',
    name: 'FLOOR',
    category: 'math',
    description: 'Round down to nearest integer',
    icon: <TrendingDown className="h-4 w-4" />,
    parameters: [],
    example: 'FLOOR(column_name)'
  },
  {
    id: 'abs',
    name: 'ABS',
    category: 'math',
    description: 'Get absolute value',
    icon: <Hash className="h-4 w-4" />,
    parameters: [],
    example: 'ABS(column_name)'
  },
  {
    id: 'power',
    name: 'POWER',
    category: 'math',
    description: 'Raise to a power',
    icon: <Zap className="h-4 w-4" />,
    parameters: [
      { name: 'exponent', type: 'number', required: true, description: 'Power to raise to', defaultValue: 2 }
    ],
    example: 'POWER(column_name, 2)'
  },
  {
    id: 'sqrt',
    name: 'SQRT',
    category: 'math',
    description: 'Calculate square root',
    icon: <Square className="h-4 w-4" />,
    parameters: [],
    example: 'SQRT(column_name)'
  },
  {
    id: 'mod',
    name: 'MOD',
    category: 'math',
    description: 'Get remainder after division',
    icon: <Percent className="h-4 w-4" />,
    parameters: [
      { name: 'divisor', type: 'number', required: true, description: 'Number to divide by', defaultValue: 10 }
    ],
    example: 'MOD(column_name, 10)'
  },
  {
    id: 'min',
    name: 'MIN',
    category: 'math',
    description: 'Get minimum of two values',
    icon: <TrendingDown className="h-4 w-4" />,
    parameters: [
      { name: 'value', type: 'number', required: true, description: 'Value to compare with', defaultValue: 100 }
    ],
    example: 'MIN(column_name, 100)'
  },
  {
    id: 'max',
    name: 'MAX',
    category: 'math',
    description: 'Get maximum of two values',
    icon: <TrendingUp className="h-4 w-4" />,
    parameters: [
      { name: 'value', type: 'number', required: true, description: 'Value to compare with', defaultValue: 0 }
    ],
    example: 'MAX(column_name, 0)'
  },

  // Date Functions
  {
    id: 'format_date',
    name: 'FORMAT_DATE',
    category: 'date',
    description: 'Format date to specified format',
    icon: <Calendar className="h-4 w-4" />,
    parameters: [
      { name: 'format', type: 'string', required: true, description: 'Date format (e.g., YYYY-MM-DD)', defaultValue: 'YYYY-MM-DD' }
    ],
    example: 'FORMAT_DATE(date_column, "YYYY-MM-DD")'
  },
  {
    id: 'extract_year',
    name: 'EXTRACT_YEAR',
    category: 'date',
    description: 'Extract year from date',
    icon: <Calendar className="h-4 w-4" />,
    parameters: [],
    example: 'EXTRACT_YEAR(date_column)'
  },
  {
    id: 'extract_month',
    name: 'EXTRACT_MONTH',
    category: 'date',
    description: 'Extract month from date',
    icon: <Calendar className="h-4 w-4" />,
    parameters: [],
    example: 'EXTRACT_MONTH(date_column)'
  },
  {
    id: 'extract_day',
    name: 'EXTRACT_DAY',
    category: 'date',
    description: 'Extract day from date',
    icon: <Calendar className="h-4 w-4" />,
    parameters: [],
    example: 'EXTRACT_DAY(date_column)'
  },
  {
    id: 'date_add',
    name: 'DATE_ADD',
    category: 'date',
    description: 'Add time to a date',
    icon: <Plus className="h-4 w-4" />,
    parameters: [
      { name: 'amount', type: 'number', required: true, description: 'Amount to add', defaultValue: 30 },
      { name: 'unit', type: 'string', required: true, description: 'Unit (days, months, years)', defaultValue: 'days' }
    ],
    example: 'DATE_ADD(date_column, 30, "days")'
  },
  {
    id: 'age_in_years',
    name: 'AGE_IN_YEARS',
    category: 'date',
    description: 'Calculate age in years from birthdate',
    icon: <Clock className="h-4 w-4" />,
    parameters: [],
    example: 'AGE_IN_YEARS(birthdate_column)'
  },
  {
    id: 'weekday',
    name: 'WEEKDAY',
    category: 'date',
    description: 'Get day of week name',
    icon: <Calendar className="h-4 w-4" />,
    parameters: [],
    example: 'WEEKDAY(date_column)'
  },
  {
    id: 'days_between',
    name: 'DAYS_BETWEEN',
    category: 'date',
    description: 'Calculate days between two dates',
    icon: <Clock className="h-4 w-4" />,
    parameters: [
      { name: 'end_date', type: 'string', required: true, description: 'End date or column name', defaultValue: 'today' }
    ],
    example: 'DAYS_BETWEEN(start_date, "2024-12-31")'
  },

  // Utility Functions
  {
    id: 'coalesce',
    name: 'COALESCE',
    category: 'utility',
    description: 'Return first non-null value',
    icon: <Shield className="h-4 w-4" />,
    parameters: [
      { name: 'fallback', type: 'string', required: true, description: 'Default value if null', defaultValue: 'N/A' }
    ],
    example: 'COALESCE(column_name, "N/A")'
  },
  {
    id: 'if_empty',
    name: 'IF_EMPTY',
    category: 'utility',
    description: 'Replace empty strings with default',
    icon: <Shield className="h-4 w-4" />,
    parameters: [
      { name: 'default', type: 'string', required: true, description: 'Default value for empty', defaultValue: 'Unknown' }
    ],
    example: 'IF_EMPTY(column_name, "Unknown")'
  },
  {
    id: 'if_condition',
    name: 'IF',
    category: 'utility',
    description: 'Conditional logic',
    icon: <GitBranch className="h-4 w-4" />,
    parameters: [
      { name: 'condition', type: 'string', required: true, description: 'Condition to check (e.g., "> 100")', defaultValue: '> 0' },
      { name: 'true_value', type: 'string', required: true, description: 'Value if condition is true', defaultValue: 'Yes' },
      { name: 'false_value', type: 'string', required: true, description: 'Value if condition is false', defaultValue: 'No' }
    ],
    example: 'IF(column_name > 0, "Positive", "Zero or Negative")'
  },
  {
    id: 'map_values',
    name: 'MAP_VALUES',
    category: 'utility',
    description: 'Map values to new values',
    icon: <Map className="h-4 w-4" />,
    parameters: [
      { name: 'mapping', type: 'string', required: true, description: 'Value mapping (JSON format)', defaultValue: '{"A": "Alpha", "B": "Beta"}' }
    ],
    example: 'MAP_VALUES(column_name, {"A": "Alpha", "B": "Beta"})'
  },
  {
    id: 'generate_id',
    name: 'GENERATE_ID',
    category: 'utility',
    description: 'Generate unique identifier',
    icon: <Hash className="h-4 w-4" />,
    parameters: [
      { name: 'prefix', type: 'string', required: false, description: 'Prefix for ID', defaultValue: 'ID' }
    ],
    example: 'GENERATE_ID("USR")'
  },
  {
    id: 'duplicate',
    name: 'DUPLICATE',
    category: 'utility',
    description: 'Duplicate the current value',
    icon: <Copy className="h-4 w-4" />,
    parameters: [],
    example: 'DUPLICATE(column_name)'
  },

  // Transform Functions
  {
    id: 'normalize',
    name: 'NORMALIZE',
    category: 'transform',
    description: 'Normalize values to 0-1 range',
    icon: <BarChart className="h-4 w-4" />,
    parameters: [
      { name: 'min_val', type: 'number', required: false, description: 'Minimum value in range', defaultValue: 0 },
      { name: 'max_val', type: 'number', required: false, description: 'Maximum value in range', defaultValue: 100 }
    ],
    example: 'NORMALIZE(column_name, 0, 100)'
  },
  {
    id: 'standardize',
    name: 'STANDARDIZE',
    category: 'transform',
    description: 'Z-score standardization',
    icon: <Target className="h-4 w-4" />,
    parameters: [],
    example: 'STANDARDIZE(column_name)'
  },
  {
    id: 'rank',
    name: 'RANK',
    category: 'transform',
    description: 'Rank values in descending order',
    icon: <Trophy className="h-4 w-4" />,
    parameters: [
      { name: 'order', type: 'string', required: false, description: 'Sort order (ASC or DESC)', defaultValue: 'DESC' }
    ],
    example: 'RANK(column_name, "DESC")'
  },
  {
    id: 'bucket',
    name: 'BUCKET',
    category: 'transform',
    description: 'Group values into buckets',
    icon: <Package className="h-4 w-4" />,
    parameters: [
      { name: 'bucket_size', type: 'number', required: true, description: 'Size of each bucket', defaultValue: 10 }
    ],
    example: 'BUCKET(column_name, 10)'
  },
  {
    id: 'percentile',
    name: 'PERCENTILE',
    category: 'transform',
    description: 'Calculate percentile rank',
    icon: <Percent className="h-4 w-4" />,
    parameters: [],
    example: 'PERCENTILE(column_name)'
  },
  {
    id: 'scale',
    name: 'SCALE',
    category: 'transform',
    description: 'Scale values to new range',
    icon: <BarChart className="h-4 w-4" />,
    parameters: [
      { name: 'new_min', type: 'number', required: true, description: 'New minimum value', defaultValue: 1 },
      { name: 'new_max', type: 'number', required: true, description: 'New maximum value', defaultValue: 10 }
    ],
    example: 'SCALE(column_name, 1, 10)'
  }
];

interface FunctionMenuProps {
  onFunctionSelect: (functionDef: FunctionDefinition, parameters: Record<string, any>) => void;
  triggerClassName?: string;
  triggerIcon?: React.ReactNode;
  columnName?: string;
  datasetData?: Record<string, any>[];
}

export function FunctionMenu({ onFunctionSelect, triggerClassName = "", triggerIcon, columnName, datasetData }: FunctionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFunction, setSelectedFunction] = useState<FunctionDefinition | null>(null);
  const [parameters, setParameters] = useState<Record<string, any>>({});

  const categories = [
    { id: 'string', name: 'String', icon: <Type className="h-4 w-4" />, color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
    { id: 'math', name: 'Math', icon: <Hash className="h-4 w-4" />, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
    { id: 'date', name: 'Date', icon: <Calendar className="h-4 w-4" />, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' },
    { id: 'utility', name: 'Utility', icon: <Filter className="h-4 w-4" />, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400' },
    { id: 'transform', name: 'Transform', icon: <Zap className="h-4 w-4" />, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' }
  ];

  const filteredFunctions = AVAILABLE_FUNCTIONS.filter(func => {
    const matchesSearch = func.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         func.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || func.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleParameterChange = (paramName: string, value: any) => {
    setParameters(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const getPreviewSamples = (func: FunctionDefinition, params: Record<string, any>) => {
    // Use real data from the dataset if available
    if (!columnName || !datasetData || datasetData.length === 0) {
      return [
        { input: 'No data available', output: 'Preview unavailable' },
        { input: 'Select a column', output: 'to see real data' },
        { input: 'transformation', output: 'preview' }
      ];
    }

    // Get sample values from the actual column data
    const columnValues = datasetData
      .slice(0, 5) // Take first 5 rows
      .map(row => row[columnName])
      .filter(value => value !== null && value !== undefined && value !== '');

    if (columnValues.length === 0) {
      return [
        { input: 'No valid data', output: 'in column' },
        { input: columnName, output: 'for preview' }
      ];
    }

    // Apply the transformation logic to real data
    const samples = columnValues.slice(0, 3).map(value => {
      const inputStr = String(value);
      let output = inputStr;

      try {
        // Use the function name to match server-side logic
        const functionName = func.name;
        
        switch (functionName) {
          case 'UPPERCASE':
            output = inputStr.toUpperCase();
            break;
          case 'LOWERCASE':
            output = inputStr.toLowerCase();
            break;
          case 'TRIM':
            output = inputStr.trim();
            break;
          case 'CAPITALIZE':
            output = inputStr.replace(/\b\w/g, l => l.toUpperCase());
            break;
          case 'REVERSE':
            output = inputStr.split('').reverse().join('');
            break;
          case 'LENGTH':
            output = inputStr.length.toString();
            break;
          case 'CONCAT':
            const separator = params.separator || '';
            output = `${inputStr}${separator}[other columns]`;
            break;
          case 'ROUND':
            const precision = parseInt(params.decimal_places) || 0;
            const numRound = parseFloat(inputStr);
            if (!isNaN(numRound)) {
              output = (Math.round(numRound * Math.pow(10, precision)) / Math.pow(10, precision)).toString();
            }
            break;
          case 'ABS':
            const numAbs = parseFloat(inputStr);
            if (!isNaN(numAbs)) {
              output = Math.abs(numAbs).toString();
            }
            break;
          case 'CEIL':
            const numCeil = parseFloat(inputStr);
            if (!isNaN(numCeil)) {
              output = Math.ceil(numCeil).toString();
            }
            break;
          case 'FLOOR':
            const numFloor = parseFloat(inputStr);
            if (!isNaN(numFloor)) {
              output = Math.floor(numFloor).toString();
            }
            break;
          case 'DATE_FORMAT':
          case 'FORMAT_DATE':
            try {
              const date = new Date(inputStr);
              if (!isNaN(date.getTime())) {
                output = date.toISOString().split('T')[0];
              }
            } catch (e) {
              output = inputStr;
            }
            break;
          case 'EXTRACT':
            const part = params.part || 'year';
            try {
              const dateObj = new Date(inputStr);
              if (!isNaN(dateObj.getTime())) {
                switch (part.toLowerCase()) {
                  case 'year': output = dateObj.getFullYear().toString(); break;
                  case 'month': output = (dateObj.getMonth() + 1).toString(); break;
                  case 'day': output = dateObj.getDate().toString(); break;
                  default: output = inputStr;
                }
              }
            } catch (e) {
              output = inputStr;
            }
            break;
          case 'IF':
            const condition = params.condition || '> 0';
            const trueValue = params.true_value || 'Yes';
            const falseValue = params.false_value || 'No';
            
            // For IF function, if there's any non-empty value, it's true
            if (inputStr && inputStr.trim() !== '' && inputStr !== 'null' && inputStr !== 'undefined') {
              output = trueValue;
            } else {
              output = falseValue;
            }
            break;
          case 'SUBSTRING':
            const start = parseInt(params.start_position) || 1;
            const length = parseInt(params.length) || 3;
            output = inputStr.substring(start - 1, start - 1 + length);
            break;
          case 'LEFT':
            const leftLength = parseInt(params.length) || 3;
            output = inputStr.substring(0, leftLength);
            break;
          case 'RIGHT':
            const rightLength = parseInt(params.length) || 3;
            output = inputStr.substring(Math.max(0, inputStr.length - rightLength));
            break;
          case 'REPLACE':
            const search = params.search_text || '';
            const replace = params.replace_text || '';
            if (search) {
              output = inputStr.replace(new RegExp(search, 'g'), replace);
            }
            break;
          case 'ADD':
            const addValue = parseFloat(params.value) || 10;
            const num = parseFloat(inputStr);
            if (!isNaN(num)) {
              output = (num + addValue).toString();
            }
            break;
          case 'MULTIPLY':
            const multValue = parseFloat(params.value) || 2;
            const numMult = parseFloat(inputStr);
            if (!isNaN(numMult)) {
              output = (numMult * multValue).toString();
            }
            break;
          case 'SUBTRACT':
            const subValue = parseFloat(params.value) || 5;
            const numSub = parseFloat(inputStr);
            if (!isNaN(numSub)) {
              output = (numSub - subValue).toString();
            }
            break;
          case 'DIVIDE':
            const divValue = parseFloat(params.value) || 2;
            const numDiv = parseFloat(inputStr);
            if (!isNaN(numDiv) && divValue !== 0) {
              output = (numDiv / divValue).toString();
            }
            break;
          case 'COALESCE':
            const fallback = params.fallback || 'N/A';
            output = inputStr && inputStr.trim() !== '' ? inputStr : fallback;
            break;
          case 'IF_EMPTY':
            const defaultValue = params.default || 'Unknown';
            output = inputStr && inputStr.trim() !== '' ? inputStr : defaultValue;
            break;
          case 'GENERATE_ID':
            const prefix = params.prefix || 'ID';
            output = `${prefix}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            break;
          case 'EXTRACT_YEAR':
            try {
              const dateExtractYear = new Date(inputStr);
              if (!isNaN(dateExtractYear.getTime())) {
                output = dateExtractYear.getFullYear().toString();
              }
            } catch (e) {
              output = inputStr;
            }
            break;
          case 'EXTRACT_MONTH':
            try {
              const dateExtractMonth = new Date(inputStr);
              if (!isNaN(dateExtractMonth.getTime())) {
                output = (dateExtractMonth.getMonth() + 1).toString();
              }
            } catch (e) {
              output = inputStr;
            }
            break;
          case 'EXTRACT_DAY':
            try {
              const dateExtractDay = new Date(inputStr);
              if (!isNaN(dateExtractDay.getTime())) {
                output = dateExtractDay.getDate().toString();
              }
            } catch (e) {
              output = inputStr;
            }
            break;
          case 'WEEKDAY':
            try {
              const dateWeekday = new Date(inputStr);
              if (!isNaN(dateWeekday.getTime())) {
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                output = days[dateWeekday.getDay()];
              }
            } catch (e) {
              output = inputStr;
            }
            break;
          case 'AGE_IN_YEARS':
            try {
              const birthDate = new Date(inputStr);
              const today = new Date();
              if (!isNaN(birthDate.getTime())) {
                const age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                  output = (age - 1).toString();
                } else {
                  output = age.toString();
                }
              }
            } catch (e) {
              output = inputStr;
            }
            break;
          default:
            output = `${functionName}(${inputStr})`;
        }
      } catch (error) {
        output = 'Error in preview';
      }

      return {
        input: inputStr.length > 25 ? inputStr.substring(0, 25) + '...' : inputStr,
        output: output.length > 25 ? output.substring(0, 25) + '...' : output
      };
    });

    return samples.length > 0 ? samples : [
      { input: 'No valid data', output: 'for preview' }
    ];
  };

  const handleApplyFunction = () => {
    if (selectedFunction) {
      onFunctionSelect(selectedFunction, parameters);
      setIsOpen(false);
      setSelectedFunction(null);
      setParameters({});
      setSearchTerm("");
      setSelectedCategory(null);
    }
  };

  const getCategoryColor = (categoryId: string) => {
    return categories.find(cat => cat.id === categoryId)?.color || 'bg-gray-100 text-gray-800';
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className={`${triggerIcon ? 'h-6 w-6 p-0' : 'h-8 w-8 p-0'} hover:bg-gray-100 dark:hover:bg-gray-800 ${triggerClassName}`}
        title="Add Function"
      >
        {triggerIcon || <Settings className="h-4 w-4" />}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-7xl h-[90vh] overflow-hidden mx-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Function Library</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsOpen(false);
              setSelectedFunction(null);
              setParameters({});
              setSearchTerm("");
              setSelectedCategory(null);
            }}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="flex flex-1 h-full min-h-0">
          {/* Left Panel - Function Browser */}
          <div className="flex-1 border-r border-gray-200 dark:border-gray-700 pr-4">
            <div className="space-y-4 h-full flex flex-col">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search functions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Categories */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className="h-7 text-xs"
                >
                  All ({AVAILABLE_FUNCTIONS.length})
                </Button>
                {categories.map(category => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className="h-7 text-xs"
                  >
                    <span className="mr-1">{category.icon}</span>
                    {category.name} ({AVAILABLE_FUNCTIONS.filter(f => f.category === category.id).length})
                  </Button>
                ))}
              </div>

              {/* Function List */}
              <div className="space-y-2 flex-1 overflow-y-auto">
                {filteredFunctions.map(func => (
                  <div
                    key={func.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedFunction?.id === func.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => setSelectedFunction(func)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="text-gray-600 dark:text-gray-400">
                          {func.icon}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{func.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {func.description}
                          </div>
                        </div>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getCategoryColor(func.category)}`}
                      >
                        {func.category}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Function Details */}
          <div className="flex-1 pl-4">
            {selectedFunction ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    {selectedFunction.icon}
                    <h3 className="text-lg font-semibold">{selectedFunction.name}</h3>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getCategoryColor(selectedFunction.category)}`}
                    >
                      {selectedFunction.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {selectedFunction.description}
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono">
                    {selectedFunction.example}
                  </div>
                </div>

                {/* Parameters */}
                {selectedFunction.parameters.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Parameters</h4>
                    {selectedFunction.parameters.map(param => {
                      // Hide new_field_name parameter when output_type is not "new_field"
                      if (param.name === 'new_field_name' && parameters.output_type !== 'new_field') {
                        return null;
                      }
                      
                      return (
                        <div key={param.name} className="space-y-1">
                          <Label className="text-xs">
                            {param.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            {param.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          {param.type === 'select' ? (
                            <select
                              value={parameters[param.name] || param.defaultValue || ''}
                              onChange={(e) => handleParameterChange(param.name, e.target.value)}
                              className="w-full text-xs h-8 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                            >
                              {param.options?.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              type={param.type === 'number' ? 'number' : 'text'}
                              placeholder={param.description}
                              value={parameters[param.name] || param.defaultValue || ''}
                              onChange={(e) => handleParameterChange(param.name, e.target.value)}
                              className="text-xs h-8"
                            />
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {param.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Function Preview */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Live Preview</h4>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border">
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="font-medium text-gray-600 dark:text-gray-400">Input</div>
                        <div className="font-medium text-gray-600 dark:text-gray-400">Output</div>
                      </div>
                      {getPreviewSamples(selectedFunction, parameters).map((sample: { input: string; output: string }, idx: number) => (
                        <div key={idx} className="grid grid-cols-2 gap-2 text-xs py-1 border-t border-gray-200 dark:border-gray-700">
                          <div className="font-mono text-gray-800 dark:text-gray-200 truncate" title={sample.input}>
                            {sample.input}
                          </div>
                          <div className="font-mono text-blue-600 dark:text-blue-400 truncate" title={sample.output}>
                            {sample.output}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button
                    onClick={handleApplyFunction}
                    className="flex-1"
                    size="sm"
                  >
                    Apply Function
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFunction(null);
                      setParameters({});
                    }}
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select a function to view details</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}