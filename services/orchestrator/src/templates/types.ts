export type TemplateName =
  | 'rust'
  | 'go'
  | 'python'
  | 'next'
  | 'static-spa'
  | 'node-api';

export interface TemplateInfo {
  name: TemplateName;
  language: string;
  description: string;
  estimatedSizeMb: number;
}
