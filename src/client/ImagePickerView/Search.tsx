import React, { FC, useState } from 'react'

interface SearchProps {
  onSearch: (query: string) => void
}

export const Search: FC<SearchProps> = ({ onSearch }) => {
  const [searchInput, setSearchInput] = useState('')

  return (
    <div className="image-picker-controls search-input-container">
      <input
        type="search"
        placeholder="Search images..."
        className="image-picker-search"
        value={searchInput}
        onChange={(e) => {
          setSearchInput(e.target.value)
          onSearch(e.target.value)
        }}
      />
    </div>
  )
}
