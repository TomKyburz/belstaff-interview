import {useState, useEffect, useCallback, useRef} from 'react';
import {Form, useLocation, useNavigate, useNavigation, useSubmit} from 'react-router';

export type FilterState = {
  priceRange: {
    min: number;
    max: number;
  };
  availability: boolean | null;
};

type Props = {
  currentFilters: FilterState;
  minPrice: number;
  maxPrice: number;
  onFiltersChange: (filters: FilterState) => void;
};

export function CollectionFilters({
  currentFilters,
  minPrice,
  maxPrice,
  onFiltersChange,
}: Props) {
  const [localFilters, setLocalFilters] = useState(currentFilters);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setLocalFilters(currentFilters);
  }, [currentFilters]);

function handleApply() {
  const params = new URLSearchParams();

  if (localFilters.priceRange.min !== minPrice) {
    params.set('priceMin', String(localFilters.priceRange.min));
  }
  if (localFilters.priceRange.max !== maxPrice) {
    params.set('priceMax', String(localFilters.priceRange.max));
  }
  if (localFilters.availability !== null) {
    params.set('available', String(localFilters.availability));
  }

  window.location.href = `${location.pathname}?${params.toString()}`;
}

  return (
  <div className="p-4 border rounded-xl bg-gray-50 w-full max-w-xs space-y-4">
    <h2 className="text-xl font-semibold">Filters</h2>

    {/* Price Range */}
    <div>
      <label className="block font-medium text-sm mb-1">Price Range</label>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>${localFilters.priceRange.min}</span>
          <span>${localFilters.priceRange.max}</span>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="range"
            className="flex-1 accent-black"
            min={minPrice}
            max={localFilters.priceRange.max}
            value={localFilters.priceRange.min}
            onChange={(e) =>
              setLocalFilters((prev) => ({
                ...prev,
                priceRange: {
                  ...prev.priceRange,
                  min: Math.min(parseFloat(e.target.value), prev.priceRange.max),
                },
              }))
            }
          />
          <input
            type="range"
            className="flex-1 accent-black"
            min={localFilters.priceRange.min}
            max={maxPrice}
            value={localFilters.priceRange.max}
            onChange={(e) =>
              setLocalFilters((prev) => ({
                ...prev,
                priceRange: {
                  ...prev.priceRange,
                  max: Math.max(parseFloat(e.target.value), prev.priceRange.min),
                },
              }))
            }
          />
        </div>
      </div>
    </div>

    {/* Availability */}
    <div>
      <label className="inline-flex items-center space-x-2">
        <input
          type="checkbox"
          className="form-checkbox"
          checked={localFilters.availability === true}
          onChange={(e) =>
            setLocalFilters((prev) => ({
              ...prev,
              availability: e.target.checked ? true : null,
            }))
          }
        />
        <span className="text-sm">In stock only</span>
      </label>
    </div>

    <button
      onClick={handleApply}
      className="w-full bg-black text-white py-2 rounded hover:bg-gray-800 transition"
    >
      Apply Filters
    </button>
  </div>
);

}
