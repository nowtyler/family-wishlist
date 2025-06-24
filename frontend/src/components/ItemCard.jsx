// ItemCard.jsx
import React from 'react';

function ItemCard({ item, isOwnWishlist /*, other props like userThinking, userPurchased, comments, onAddToThinking, onMarkPurchased, onAddComment, onEditItem, onDeleteItem */ }) {
  return (
    <div className="item-card">
      <h4 className="line-clamp-2 break-words overflow-hidden">{item.title}</h4>
      {item.description && <p className="line-clamp-3 break-words whitespace-pre-wrap">{item.description}</p>}
      {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer">View Link</a>}
      {item.image_url && <img src={item.image_url} alt={item.title} style={{ maxWidth: '100px', maxHeight: '100px' }} />}
      {item.priority && <p>Priority: {item.priority}</p>}

      {isOwnWishlist ? (
        <div className="own-wishlist-actions">
          <button>Edit</button>
          <button>Delete</button>
        </div>
      ) : (
        <div className="other-wishlist-actions">
          <button>Thinking About</button> {/* Conditionally show if current user is thinking */}
          <button>Mark Purchased</button> {/* Conditionally show "Purchased" status */}

          {/* Conditionally render comments from others and input for current user to add */}
          <div className="comments-section">
            {/* Render comments */}
            <div>
              {/* Input to add a new comment */}
              <input type="text" placeholder="Add a comment..." />
              <button>Post</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ItemCard;