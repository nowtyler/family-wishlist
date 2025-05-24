// WishlistCard.jsx
import React from 'react';
import ItemCard from './ItemCard';
// Potentially import AddItemForm here if rendered within the card

function WishlistCard({ wishlist, isOwnWishlist, /* other relevant props like addItem */ }) {
  return (
    <div className="wishlist-card">
      <h3>{wishlist.name}</h3>
      {isOwnWishlist && (
        // Option to render AddItemForm here or have a separate button/modal trigger
        // <AddItemForm wishlistId={wishlist.id} onAddItem={addItem} />
        <button>Add New Item</button>
      )}
      <div className="items-container">
        {wishlist.items.map(item => (
          <ItemCard
            key={item.id}
            item={item}
            isOwnWishlist={isOwnWishlist}
            // Potentially pass down functions for editing/deleting here
          />
        ))}
      </div>
    </div>
  );
}

export default WishlistCard;