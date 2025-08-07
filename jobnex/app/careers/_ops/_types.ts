export interface CareerPost {
  id: number;
  title: string;
  content: string;
  location: string;
  createdAt: string;
  category?: CareerCategory;
}

export interface CareerCategory {
  id: number;
  name: string;
}

export interface Application {
  id: number;
  fullName: string;
  phoneNumber: string;
  email: string;
  cvPath: string;
  documentPath?: string;
  status: "pending" | "viewed" | "accepted" | "rejected";
  createdAt: string;
  careerId: number;
  career: {
    title: string;
    location: string;
    category?: CareerCategory;
  };
}