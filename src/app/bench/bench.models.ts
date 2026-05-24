export interface BenchItem {
  id: string;
  name: string;
  category: 'electronics' | 'home';
  price: number;
}

export interface ItemsResponse {
  items: BenchItem[];
}
