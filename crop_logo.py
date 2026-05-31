from PIL import Image
import numpy as np

def crop_and_transparent(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img)
    
    # Assuming black is [0, 0, 0] or very close to it. Let's say < 20 for R, G, B
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    mask = (r < 20) & (g < 20) & (b < 20)
    
    # Make black pixels transparent
    data[mask, 3] = 0
    
    # Now find the bounding box of non-transparent pixels
    non_transparent = np.where(data[:,:,3] > 0)
    if len(non_transparent[0]) > 0:
        min_y, max_y = np.min(non_transparent[0]), np.max(non_transparent[0])
        min_x, max_x = np.min(non_transparent[1]), np.max(non_transparent[1])
        
        # Add a little padding (e.g., 5 pixels)
        pad = 5
        min_y = max(0, min_y - pad)
        max_y = min(data.shape[0], max_y + pad)
        min_x = max(0, min_x - pad)
        max_x = min(data.shape[1], max_x + pad)
        
        # Crop the image
        cropped_data = data[min_y:max_y, min_x:max_x]
        cropped_img = Image.fromarray(cropped_data)
        cropped_img.save(output_path)
        print(f"Successfully processed and saved to {output_path}")
    else:
        print("Image was fully transparent or black.")

crop_and_transparent("public/img/logo.png", "public/img/logo_cropped.png")
