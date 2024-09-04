from fastapi import FastAPI
from pydantic import BaseModel
from transformers import pipeline

app = FastAPI()

class Prompt(BaseModel):
    text: str

@app.get('/')
def read_root():
    return {'Hello': 'World'}

@app.post('/items/')
def create_item(prompt: Prompt):
    generator = pipeline("text-generation", model="chargoddard/loyal-piano-m7")
    response = generator(prompt.text, max_length=300, temperature=0.8)
    return response[0]['generated_text']

