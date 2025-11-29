import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface MapMyIndiaAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface Suggestion {
  placeName?: string;
  placeAddress?: string;
  eLoc?: string;
  // Alternative field names that might be used
  place_name?: string;
  place_address?: string;
  eloc?: string;
  description?: string;
  address?: string;
}

const MapMyIndiaAutocomplete: React.FC<MapMyIndiaAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Search for locations...",
  className
}) => {
  console.log("[MapMyIndiaAutocomplete] Rendered with value:", value);
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Ensure query is set on mount
  useEffect(() => {
    if (value && !query) {
      setQuery(value);
    }
  }, []);

  const searchLocations = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    const apiKey = import.meta.env.VITE_MAPMYINDIA_API_KEY || '';

    try {
      const response = await fetch(
        `/api/mapmyindia/autosuggest?query=${encodeURIComponent(searchQuery)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': localStorage.getItem('auth_token') || '',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Map My India frontend response:', data);
        if (data.suggestedLocations && data.suggestedLocations.length > 0) {
          // Map My India format
          setSuggestions(data.suggestedLocations.slice(0, 10));
        } else if (data.suggestions && data.suggestions.length > 0) {
          // Alternative Map My India format
          setSuggestions(data.suggestions.slice(0, 10));
        } else {
          setSuggestions([]);
        }
      } else {
        console.error('Map My India frontend API error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Frontend error response:', errorText);
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    console.log("[MapMyIndiaAutocomplete] Input changed to:", newQuery);
    setQuery(newQuery);
    onChange(newQuery); // Update parent immediately
    setSelectedIndex(-1);
    setShowSuggestions(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (newQuery.length >= 2) {
        searchLocations(newQuery);
      } else {
        setSuggestions([]);
      }
    }, 300);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    const placeName = suggestion.placeName || suggestion.place_name || suggestion.description || '';
    const placeAddress = suggestion.placeAddress || suggestion.place_address || suggestion.address || '';
    const locationText = placeAddress ? `${placeName}, ${placeAddress}` : placeName;
    console.log("[MapMyIndiaAutocomplete] Suggestion clicked:", locationText);
    setQuery(locationText);
    onChange(locationText);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    // Don't blur the input - allow continued editing
    // inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }, 150);
  };

  // Handle form submission or when input loses focus
  const handleInputSubmit = () => {
    // Ensure the current query value is passed to parent
    onChange(query);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleInputFocus}
        onBlur={() => {
          console.log("[MapMyIndiaAutocomplete] Input blurred, final value:", query);
          handleInputBlur();
          // Ensure value is saved when input loses focus
          setTimeout(() => {
            console.log("[MapMyIndiaAutocomplete] Calling onChange on blur:", query);
            onChange(query);
          }, 200);
        }}
        placeholder={placeholder}
        className={cn("w-full", className)}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {isLoading && (
            <div className="px-4 py-2 text-sm text-gray-500">
              Searching...
            </div>
          )}
          {suggestions.map((suggestion, index) => {
            const placeName = suggestion.placeName || suggestion.place_name || suggestion.description || '';
            const placeAddress = suggestion.placeAddress || suggestion.place_address || suggestion.address || '';
            const uniqueKey = suggestion.eLoc || suggestion.eloc || `suggestion-${index}`;

            return (
              <div
                key={uniqueKey}
                className={cn(
                  "px-4 py-2 text-sm cursor-pointer hover:bg-gray-50",
                  index === selectedIndex && "bg-blue-50"
                )}
                onMouseDown={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="font-medium text-gray-900">
                  {placeName}
                </div>
                {placeAddress && (
                  <div className="text-gray-500 text-xs">
                    {placeAddress}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MapMyIndiaAutocomplete;
