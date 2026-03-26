import { weaviateClient } from '../lib/weaviate';

const CAR_CLASS = 'Car';
const CAR_REVIEW_CLASS = 'CarReview';

export interface CarSearchFilters {
  fuelType?: string;
  carType?: string;
  maxMsrp?: number;
}

export interface WeaviateCarResult {
  carId: string;
  brand: string;
  model: string;
  variant: string;
  fuelType: string;
  carType: string;
  msrp: number;
  specsSummary: string;
  score?: number;
}

interface WeaviateGraphqlResult {
  data?: {
    Get?: Record<string, Array<Record<string, unknown> & { _additional?: { certainty?: number } }>>;
  };
}

export class WeaviateService {
  async ensureSchema() {
    const schema = await weaviateClient.schema.getter().do();
    const classes = (schema.classes || []).map((klass: { class?: string }) => klass.class);

    if (!classes.includes(CAR_CLASS)) {
      await weaviateClient.schema
        .classCreator()
        .withClass({
          class: CAR_CLASS,
          vectorizer: 'text2vec-transformers',
          properties: [
            { name: 'carId', dataType: ['text'] },
            { name: 'brand', dataType: ['text'] },
            { name: 'model', dataType: ['text'] },
            { name: 'variant', dataType: ['text'] },
            { name: 'fuelType', dataType: ['text'] },
            { name: 'carType', dataType: ['text'] },
            { name: 'msrp', dataType: ['int'] },
            { name: 'specsSummary', dataType: ['text'] },
          ],
        })
        .do();
    }

    if (!classes.includes(CAR_REVIEW_CLASS)) {
      await weaviateClient.schema
        .classCreator()
        .withClass({
          class: CAR_REVIEW_CLASS,
          vectorizer: 'text2vec-transformers',
          properties: [
            { name: 'reviewId', dataType: ['text'] },
            { name: 'carId', dataType: ['text'] },
            { name: 'brand', dataType: ['text'] },
            { name: 'model', dataType: ['text'] },
            { name: 'reviewText', dataType: ['text'] },
            { name: 'sentiment', dataType: ['text'] },
          ],
        })
        .do();
    }
  }

  async searchCars(query: string, filters?: CarSearchFilters): Promise<WeaviateCarResult[]> {
    const fields = `
      carId
      brand
      model
      variant
      fuelType
      carType
      msrp
      specsSummary
      _additional { certainty }
    `;

    let getter = weaviateClient.graphql
      .get()
      .withClassName(CAR_CLASS)
      .withFields(fields)
      .withNearText({ concepts: [query] })
      .withLimit(10);

    const whereOperands: Array<Record<string, unknown>> = [];
    if (filters?.fuelType) {
      whereOperands.push({ path: ['fuelType'], operator: 'Equal', valueText: filters.fuelType });
    }
    if (filters?.carType) {
      whereOperands.push({ path: ['carType'], operator: 'Equal', valueText: filters.carType });
    }
    if (filters?.maxMsrp) {
      whereOperands.push({ path: ['msrp'], operator: 'LessThanEqual', valueInt: filters.maxMsrp });
    }

    if (whereOperands.length === 1) {
      getter = getter.withWhere(whereOperands[0]);
    } else if (whereOperands.length > 1) {
      getter = getter.withWhere({ operator: 'And', operands: whereOperands });
    }

    const result = await getter.do();
    const gqlResult = result as WeaviateGraphqlResult;
    const rows = (gqlResult?.data?.Get?.[CAR_CLASS] || []).map((row) => ({
      ...row,
      score: row?._additional?.certainty,
    }));

    return rows as WeaviateCarResult[];
  }

  async getCarContext(carId: string): Promise<WeaviateCarResult | null> {
    const result = await weaviateClient.graphql
      .get()
      .withClassName(CAR_CLASS)
      .withFields('carId brand model variant fuelType carType msrp specsSummary _additional { certainty }')
      .withWhere({
        path: ['carId'],
        operator: 'Equal',
        valueText: carId,
      })
      .withLimit(1)
      .do();

    const gqlResult = result as WeaviateGraphqlResult;
    const row = gqlResult?.data?.Get?.[CAR_CLASS]?.[0];
    if (!row) {
      return null;
    }

    return {
      ...row,
      score: row?._additional?.certainty,
    } as WeaviateCarResult;
  }
}

export const weaviateService = new WeaviateService();
