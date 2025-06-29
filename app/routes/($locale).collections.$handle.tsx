import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, type MetaFunction} from 'react-router';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {ProductItem} from '~/components/ProductItem';
import {CollectionFilters, type FilterState} from '~/components/CollectionFilters';
import {useState, useMemo, useEffect} from 'react';

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [{title: `Hydrogen | ${data?.collection.title ?? ''} Collection`}];
};

export async function loader(args: LoaderFunctionArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({
  context,
  params,
  request,
}: LoaderFunctionArgs) {
  const {handle} = params;
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  if (!handle) {
    throw redirect('/collections');
  }

  // Parse filter parameters from URL
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  const filters: any[] = [];
  
  // Price range filter
  const priceMin = searchParams.get('priceMin');
  const priceMax = searchParams.get('priceMax');
  if (priceMin || priceMax) {
    const priceFilter: any = {
      price: {},
    };
    if (priceMin) {
      priceFilter.price.min = parseFloat(priceMin);
    }
    if (priceMax) {
      priceFilter.price.max = parseFloat(priceMax);
    }
    filters.push(priceFilter);
  }

  // Availability filter
  const available = searchParams.get('available');
  if (available !== null && available !== '') {
    filters.push({
      available: available === 'true',
    });
  }

  // Query collection with filters applied
  const [{collection}] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: {
        handle,
        filters: filters.length > 0 ? filters : null,
        ...paginationVariables,
      },
    }),
  ]);

  // If we have filters applied, we need to get the base collection for price range calculation
  let baseCollection = collection;
  if (filters.length > 0) {
    const [{collection: unfiltered}] = await Promise.all([
      storefront.query(COLLECTION_QUERY, {
        variables: {
          handle,
          first: 250,
          //filters // Get more products to calculate accurate price range
        },
      }),
    ]);
    baseCollection = unfiltered;
  }
  console.log(JSON.stringify({filters, COLLECTION_QUERY}, null, 2))
  if (!collection || !baseCollection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: collection});

  // Calculate price range from all products (not filtered) for the filter component
  const priceRange = calculatePriceRange(baseCollection.products.nodes);

  return {
    collection,
    priceRange,
    appliedFilters: {
      priceRange: {
        min: priceMin ? parseFloat(priceMin) : priceRange.min,
        max: priceMax ? parseFloat(priceMax) : priceRange.max,
      },
      availability: available ? available === 'true' : null,
    },
  };
}

function calculatePriceRange(products: any[]) {
  if (!products || products.length === 0) {
    return {min: 0, max: 1000};
  }

  let min = Infinity;
  let max = 0;

  products.forEach((product: any) => {
    if (product?.priceRange?.minVariantPrice?.amount) {
      const minPrice = parseFloat(product.priceRange.minVariantPrice.amount);
      const maxPrice = parseFloat(product.priceRange.maxVariantPrice.amount);
      
      if (minPrice < min) min = minPrice;
      if (maxPrice > max) max = maxPrice;
    }
  });

  return {
    min: min === Infinity ? 0 : Math.floor(min),
    max: Math.ceil(max),
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: LoaderFunctionArgs) {
  return {};
}

export default function Collection() {
  const {collection, priceRange, appliedFilters} = useLoaderData<typeof loader>();
  
  const [currentFilters, setCurrentFilters] = useState<FilterState>(appliedFilters || {
    priceRange: priceRange || {min: 0, max: 1000},
    availability: null,
  });

  useEffect(() => {

  }, [appliedFilters])

  return (
    <div className="collection">
      <h1>{collection.title}</h1>
      <p className="collection-description">{collection.description}</p>
      
      <div className="collection-content">
        <div className="collection-sidebar">
          <CollectionFilters
            currentFilters={currentFilters}
            minPrice={priceRange?.min || 0}
            maxPrice={priceRange?.max || 1000}
            onFiltersChange={setCurrentFilters}
          />
        </div>
        
        <div className="collection-main">
          <PaginatedResourceSection
            connection={collection.products}
            resourcesClassName="products-grid"
          >
            {({node: product, index}) => {
              if (currentFilters.availability !== null) {
                if (product.availableForSale !== currentFilters.availability) {
                  return
                }
              }
              if (product.priceRange.minVariantPrice.amount < currentFilters.priceRange.min) {
                return
                }
                if(product.priceRange.maxVariantPrice.amount > currentFilters.priceRange.max) {
                  return
                }
              return (
              <ProductItem
                key={product.id}
                product={product as any}
                loading={index < 8 ? 'eager' : undefined}
              />)
            }}
          </PaginatedResourceSection>
        </div>
      </div>
      
      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
          },
        }}
      />
    </div>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    availableForSale
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $filters: [ProductFilter!]
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor,
        filters: $filters
      ) {
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
` as const;
