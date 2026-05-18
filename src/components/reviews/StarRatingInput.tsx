type StarRatingInputProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export default function StarRatingInput({ value, onChange, disabled = false }: StarRatingInputProps) {
  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((rating) => {
        const selected = value >= rating;
        return (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={value === rating}
            aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
            disabled={disabled}
            onClick={() => onChange(rating)}
            className={`rounded-full px-1 text-2xl transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 ${
              selected ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'
            }`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
