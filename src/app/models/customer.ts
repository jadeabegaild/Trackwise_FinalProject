export interface Customer {
  id?: string;
  name: string;    // <-- Add this if missing
  tier: string;    // <-- Add this if missing
  email?: string;
  phone?: string;
  createdAt?: any;
  updatedAt?: any;
}
