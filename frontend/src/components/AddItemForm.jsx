// AddItemForm.jsx
import React, { useState } from 'react';

function AddItemForm({ wishlistId, onAddItem, onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [image_url, setImageUrl] = useState('');
  const [priority, setPriority] = useState('Medium'); // Default value

  const handleSubmit = (event) => {
    event.preventDefault();
    const newItem = {
      wishlist_id: wishlistId,
      title,
      description,
      link,
      image_url,
      priority,
    };
    onAddItem(newItem); // Function passed from WishlistCard to handle adding
    onClose(); // If it's a modal, this would close it
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Add New Item</h3>
      <div>
        <label htmlFor="title">Title:</label>
        <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="description">Description:</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label htmlFor="link">Link:</label>
        <input type="url" id="link" value={link} onChange={(e) => setLink(e.target.value)} />
      </div>
      <div>
        <label htmlFor="image_url">Image URL:</label>
        <input type="url" id="image_url" value={image_url} onChange={(e) => setImageUrl(e.target.value)} />
      </div>
      <div>
        <label htmlFor="priority">Priority:</label>
        <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
      <button type="submit">Add Item</button>
      <button type="button" onClick={onClose}>Cancel</button> {/* Only if it's a modal */}
    </form>
  );
}

export default AddItemForm;