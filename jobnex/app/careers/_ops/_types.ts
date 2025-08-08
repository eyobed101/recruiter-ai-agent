import { ReactNode } from "react";

export interface CareerPost {
  category_id: number;
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
  career_id: number;
  name: ReactNode;
  location: ReactNode;
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