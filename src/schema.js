const string = { type: 'string' };
const list = items => ({ type: 'array', items });
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const enumeration = values => ({ type: 'string', enum: values });
const refs = list(string);
export const flowSchema = object({
  entryId: string,
  status: enumeration(['analyzed', 'blocked']),
  summary: string,
  handler: string,
  evidence: list(object({ id: string, file: string, startLine: {type:'integer'}, endLine: {type:'integer'}, quote: string, claim: string, status: enumeration(['code','inferred','unresolved']) })),
  dependencies: list(object({ id:string, label:string, kind:enumeration(['api','database','cache','broker','external']), technology:string, target:string, evidenceIds:refs })),
  steps: list(object({ id:string, dependencyId:string, operation:string, mode:enumeration(['sync','async','parallel']), condition:string, evidenceIds:refs })),
  branches: list(object({ id:string, condition:string, explanation:string, evidenceIds:refs })),
  errors: list(object({ behavior:string, evidenceIds:refs })),
  limits: list(string),
  sequenceMermaid: string
});
export const resultSchema = object({ flows: list(flowSchema) });
