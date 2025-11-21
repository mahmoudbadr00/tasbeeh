
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/firebaseService.ts
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  DocumentData
} from 'firebase/firestore';
import { Task } from '@/interfaces/types';

const tasksColRef = collection(db, 'tasks');

export const firebaseService = {
  // جلب المهام حسب التاريخ (format: 'YYYY-MM-DD')
  async getTasks(date: string): Promise<Task[]> {
    const q = query(tasksColRef, where('date', '==', date));
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(d => {
      const data = d.data() as DocumentData;
      return {
        id: d.id,
        member: data.member || '',
        project: data.project || '',
        branch: data.branch || '',
        task: data.task || '',
        status: data.status || '',
        note: data.note || '',
        date: data.date || date,
        created_at: data.created_at ?? Date.now(),
        updated_at: data.updated_at ?? Date.now()
      } as Task;
    });

    // اختياري: فرز حسب created_at
    docs.sort((a, b) => (a.created_at as number) - (b.created_at as number));
    return docs;
  },

  // إنشاء مهمة جديدة
  async createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
    const now = Date.now();
    const newTask = {
      ...task,
      created_at: now,
      updated_at: now,
    };
    const docRef = await addDoc(tasksColRef, newTask);
    return { ...newTask, id: docRef.id } as Task;
  },

  // تحديث مهمة - التحديث يستقبل partial ويضع updated_at
  async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    const payload: any = {
      ...updates,
      updated_at: Date.now(),
    };
    await updateDoc(doc(db, 'tasks', id), payload);
  },

  // حذف مهمة
  async deleteTask(id: string): Promise<void> {
    await deleteDoc(doc(db, 'tasks', id));
  }
};
